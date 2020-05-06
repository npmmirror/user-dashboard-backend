/* eslint-disable @typescript-eslint/camelcase */
import { Controller, Get, Post, Body, Res, HttpStatus, UseGuards, Req, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response, Request } from 'express';
import WechatOauth from 'wechat-oauth-ts';

import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './auth.dto';
import { UserService } from 'src/user/user.service';
import { User } from 'src/user/user.entity';
import { getDomainFromUrl } from 'src/utils';
import { apiBase, MS_OAUTH2_URL, WX_OAUTH2_URL } from 'src/constants/config';
import { ConfigService } from 'config/config.service';
import { RegisterTypes } from 'src/constants/enums';

interface IState {
  to: string;
  userId?: number
}

const getWXAuthenticationUrl = (options: { to: string; clientId: string; userId?: number }) => {
  let state;
  if (options.userId) {
    state = JSON.stringify({
      to: options.to,
      userId: options.userId,
    })
  } else {
    state = JSON.stringify({
      to: options.to,
    })
  }
  const params = new URLSearchParams({
    appid: options.clientId,
    response_type: 'code',
    redirect_uri: getDomainFromUrl(options.to) + apiBase+ '/api/auth/wechat',
    scope: 'snsapi_userinfo,snsapi_login',
    state: encodeURIComponent(state)
  })
  return WX_OAUTH2_URL + '?' + params
}

const getMSAuthenticationUrl = (options: { to: string; clientId: string; userId?: number }) => {
  let state;
  if (options.userId) {
    state = JSON.stringify({
      to: options.to,
      userId: options.userId,
    })
  } else {
    state = JSON.stringify({
      to: options.to,
    })
  }
  const params = new URLSearchParams({
    client_id: options.clientId,
    response_type: 'code',
    redirect_uri: getDomainFromUrl(options.to) + apiBase+ '/api/auth/microsoft',
    response_mode: 'query',
    scope: 'openid profile email',
    state: state
  })
  return MS_OAUTH2_URL + '/authorize?' + params
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {
    
  }

  @Post('/register')
  async register(@Body() body: RegisterDto, @Res() res: Response) {
    const { userName, password, nickName, microsoftId, wechatId } = body;
    const userNameUnique = await this.userService.userNameUnique([userName]);
    if (userNameUnique.length > 0) {
      res.send({
        success: false,
        duplicate: true,
      })
      return;
    }
    if (!microsoftId && !wechatId) {
      await this.userService.create([{
        userName,
        nickName,
        password,
      }]);
    } else if (microsoftId) {
      await this.userService.signUpByMicrosoftId(microsoftId, {
        userName, password, nickName
      })
    } else if (wechatId) {
      //
    }
    
    res.send({
      success: true
    })
  }

  @Post('/login')
  async login(@Body() body: LoginDto, @Res() res: Response) {
    const { userName, password } = body;
    const validatedUser = await this.authService.validateUserAccount(userName, password);
    if (validatedUser) {
      const token = await this.authService.getIdToken(validatedUser.id, validatedUser.userName);
      const currentAuthority = await this.authService.getUserRoles(validatedUser.id);
      res.cookie('token', token);
      res.send({
        success: true,
        token,
        currentAuthority,
        currentPermission: [],
      })
    } else {
      res.status(HttpStatus.UNAUTHORIZED).send({
        success: false,
        message: 'UNAUTHORIZED',
      })
    }
  }

  @Get('/currentUser')
  @UseGuards(AuthGuard('jwt'))
  async getCurrentUser(@Req() req: Request, @Res() res: Response): Promise<any> {
    const user = (req.user as User);
    const currentAuthority = await this.authService.getUserRoles(user.id);
    if (user) {
      res.send({
        success: true,
        id: user.id,
        userName: user.userName,
        phone: user.phone,
        registerType: user.registerType,
        email: user.email,
        openId: user.openId,
        microsoftId: user.microsoftId,
        nickName: user.nickName,
        currentAuthority,
      })
    } else {
      res.status(HttpStatus.UNAUTHORIZED)
    }
    
  }

  @Get('/microsoft')
  async loginWithMicrosoft(
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('to') to?: string,
    @Query('state') state?: string,
    @Query('userId') userId?: number
  ) {
    if (code) {
      // 微软的回调
      const stateObj: IState = JSON.parse(state as string);
      if (!stateObj.userId) {
        // 用户直接登录
        const userInfo = await this.authService.getMicrosoftAccountInfo(code, getDomainFromUrl(stateObj.to) + apiBase+ '/api/auth/microsoft');
        const user = await this.userService.getMSUserInfoByOpenId(userInfo.openId, userInfo.nickName, userInfo.registerType);
        if (user) {
          const token = this.authService.getIdToken(user.id, user.userName);
          res.cookie('token', token);
          res.redirect(stateObj.to + '?token=' + token);
        }
      } else {
        // 已经有账号，来绑定的用户
        const userInfo = await this.authService.getMicrosoftAccountInfo(code, getDomainFromUrl(stateObj.to) + apiBase+ '/api/auth/microsoft');
        const dbUser = await this.userService.updateUserMicrosoftId(stateObj.userId, userInfo.openId);
        if (dbUser) {
          const token = this.authService.getIdToken(stateObj.userId, dbUser.userName);
          res.cookie('token', token);
          res.redirect(stateObj.to + '?token=' + token);
        } else {
          res.redirect(stateObj.to + '?error=no such user' );
        }
      }
      
    } else if (to) {
      // 前端主动访问
      let redirect: string;
      if (userId) {
        userId = Number(userId);
        redirect = getMSAuthenticationUrl({
          to,
          userId,
          clientId: this.config.get('MS_CLIENT_ID')
        });
      } else {
        redirect = getMSAuthenticationUrl({
          to,
          clientId: this.config.get('MS_CLIENT_ID')
        });
      }
      
      res.redirect(redirect);
    }
  }

  @Get('/wechat')
  async loginWithWechat(
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('to') to?: string,
    @Query('state') state?: string,
    @Query('userId') userId?: number
  ) {
    const WX_APP_ID = this.config.get('WX_APP_ID');
    const WX_SECRET = this.config.get('WX_SECRET');
    const wxOauth = new WechatOauth(WX_APP_ID, WX_SECRET);
    if (code) {
      // 微信回调
      const accessToken = await wxOauth.getAccessToken(code);
      const openId = accessToken.openid;
      const unionId: string = (accessToken as any).unionid;
      const { nickname } = await wxOauth.getUserByOpenId(openId);
      console.log(111, state)
      const stateObj: IState = JSON.parse(state as string);
      console.log('nickName', nickname);
      if (!stateObj.userId) {
        // 用户直接扫码登录
        let tempOpenId = '';
        if (unionId) {
          tempOpenId = 'unionId--' + unionId
        } else {
          tempOpenId = 'openId--' + openId;
        }
        const user = await this.userService.getWXUserInfoByOpenId(tempOpenId, nickname, RegisterTypes.Wechat);
        if (user) {
          const token = this.authService.getIdToken(user.id, user.userName);
          res.cookie('token', token);
          res.redirect(stateObj.to + '?token=' + token);
        }
      } else {
        // 用户绑定微信
      }

    } else if (to) {
      // 前端主动跳转
      let redirect: string;
      if (userId) {
        userId = Number(userId);
        redirect = getWXAuthenticationUrl({
          to,
          userId,
          clientId: WX_APP_ID
        });
      } else {
        redirect = getWXAuthenticationUrl({
          to,
          clientId: WX_APP_ID
        });
      }
      
      res.redirect(redirect);
    }
  }
}
