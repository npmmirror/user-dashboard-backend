import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './user/user.module';
import { typeOrmConfig } from './db/typeorm';
import { GroupModule } from './group/group.module';
import { PermissionModule } from './permission/permission.module';

import { CasbinModule } from './common/authz';
import { RoleModule } from './role/role.module';
import { ConnectionOptions } from 'typeorm';
import { GroupUserModule } from './group-user/group-user.module';
import { GroupRoleModule } from './group-role/group-role.module';
import { UserRoleModule } from './user-role/user-role.module';
import { AuthModule } from './auth/auth.module';
import { PassportModule } from '@nestjs/passport';
import { PermissionService } from './permission/permission.service';
import { PermissionController } from './permission/permission.controller';
import { Permission } from './permission/permission.entity';


@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.develop.env.local', '.env.develop']
    }),
    CasbinModule.forRootAsync(
      typeOrmConfig as ConnectionOptions,
      "src/common/authz/authz.model.conf"
    ),
    TypeOrmModule.forRoot(typeOrmConfig as TypeOrmModuleOptions),
    UserModule,
    GroupModule,
    PermissionModule,
    RoleModule,
    GroupUserModule,
    GroupRoleModule,
    UserRoleModule,
    AuthModule,
    TypeOrmModule.forFeature([Permission])
  ],
  controllers: [AppController],
  providers: [AppService, PermissionService],
})
export class AppModule {}
