
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Injectable, Res } from '@nestjs/common';
import { Brackets } from 'typeorm';
import { IUserMessage } from './user.controller';

import { RegisterTypes } from 'src/config/enums'
import { User } from './user.entity';
import { UserRole } from 'src/user-role/user-role.entity';
import { EditUserDto } from './user.dto';
import { ConfigService } from 'config/config.service';
import { encodePassword } from 'src/utils';

interface ICreateUser extends IUserMessage {
  createTime: string;
  openId: string;
  registerType: string;
}

const userNameQuery = 'userName LIKE :search';
const nickNameQuery = 'nickName LIKE :search';
const emailQuery = 'email LIKE :search';
const noteQuery = 'note LIKE :search';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    private readonly config: ConfigService,
  ) { }

  async getUserCount(): Promise<number> {
    return await this.usersRepository
      .createQueryBuilder('user')
      .where('isDelete != 1')
      .getCount();
  }

  async find(pageNo: number, pageSize: number): Promise<{list: User[], total: number}> {
    const total = await this.getUserCount();
    const list = await this.usersRepository
      .createQueryBuilder('user')
      .select(['user.userName', 'user.nickName', 'user.phone', 'user.email', 'user.note', 'user.id'])
      .where('isDelete != 1')
      .skip(pageNo * pageSize)
      .take(pageSize)
      .getMany();
    return {
      list,
      total
    };
  }

  async findAll() {
    const total = await this.getUserCount();
    const list = await this.usersRepository
      .createQueryBuilder('user')
      .select(['user.userName', 'user.id', 'user.nickName', 'user.phone', 'user.email', 'user.note'])
      .where('isDelete != 1')
      .getMany();
    return {
      list,
      total
    };
  }

  async findAllLike(search?: string) {
    search = '%' + search + '%';
    const total = await this.usersRepository
      .createQueryBuilder('user')
      .where('isDelete != 1')
      .andWhere(new Brackets(subQuery => {
        return subQuery
          .where(userNameQuery)
          .orWhere(nickNameQuery)
      }))
      .setParameters(
        {search: search}
      )
      .getCount();
    const list = await this.usersRepository
      .createQueryBuilder('user')
      .select(['user.userName', 'user.nickName', 'user.phone', 'user.email', 'user.note', 'user.id'])
      .where('isDelete != 1')
      .andWhere(new Brackets(subQuery => {
        return subQuery
          .where(userNameQuery)
          .orWhere(nickNameQuery)
          .orWhere(emailQuery)
          .orWhere(noteQuery)
      }))
      .setParameters(
        {search: search}
      )
      .getMany();
    return {
      list,
      total
    };
  }

  async findLike(pageNo: number, pageSize: number, search: string): Promise<{list: User[], total: number}> {
    
    search = '%' + search + '%';
    const total = await this.usersRepository
      .createQueryBuilder('user')
      .where('isDelete != 1')
      .andWhere(new Brackets(subQuery => {
        return subQuery
          .where(userNameQuery)
          .orWhere(nickNameQuery)
      }))
      .setParameters(
        {search: search}
      )
      .getCount();
    const list = await this.usersRepository
      .createQueryBuilder('user')
      .select(['user.userName', 'user.nickName', 'user.phone', 'user.email', 'user.note', 'user.id'])
      .where('isDelete != 1')
      .andWhere(new Brackets(subQuery => {
        return subQuery
          .where(userNameQuery)
          .orWhere(nickNameQuery)
          .orWhere(emailQuery)
          .orWhere(noteQuery)
      }))
      .setParameters(
        {search: search}
      )
      .skip(pageNo * pageSize)
      .take(pageSize)
      .getMany();
    return {
      list,
      total
    };
  }
  
  async userNameUnique(userName: string[]) {
    return await this.usersRepository
      .createQueryBuilder()
      .select('userName')
      .where("user.userName IN (:...names)", { names: userName })
      .execute()
  }

  async create(users: IUserMessage[]): Promise<any> {
    const newUsers: ICreateUser[] = [];
    const SECRET_KEY = this.config.get('SECRET_KEY');
    users.forEach(u => {
      u.password = encodePassword(u.password, SECRET_KEY);
      newUsers.push({
        ...u,
        openId: u.userName,
        registerType: RegisterTypes.Account,
        createTime: new Date().getTime() + '',
      })
    });
    return await this.usersRepository
      .createQueryBuilder()
      .insert()
      .into(User)
      .values(newUsers)
      .execute();

  }

  async remove(userNames: string[]): Promise<any> {
    return await this.usersRepository
      .createQueryBuilder('user')
      .update(User)
      .set({isDelete: 1})
      .where('user.userName IN (:userNames)', {
        userNames: userNames
      })
      .execute()
  }

  async findUserByUserNames(userNames: string[]): Promise<any[]> {
    return await this.usersRepository
      .createQueryBuilder('user')
      .select(['userName', 'id'])
      .where("user.userName IN (:userNames)", { userNames: userNames })
      .execute()
  }

  async findUsersByUserIds(userIds: number[]): Promise<any[]> {
    return await this.usersRepository
      .createQueryBuilder('user')
      .select(['userName', 'id', 'nickName', 'email', 'openId', 'note', 'phone'])
      .where("user.id IN (:userIds)", { userIds: userIds })
      .execute()
  }

  async getUserById(id: number) {
    return await this.usersRepository
    .createQueryBuilder('user')
    .select(['userName', 'id', 'nickName', 'email', 'openId', 'note', 'phone'])
    .where('id = ' + id)
    .take(1)
    .execute()
  }

  async editUserDetail(id: number, email: string, phone: string, note: string, nickName: string) {
    const detail = await this.usersRepository.findOne(id);
    if (detail) {
      detail.nickName = nickName;
      detail.note = note;
      detail.phone = phone;
      detail.email = email;
      await this.usersRepository.save(detail);
    }
  }
}