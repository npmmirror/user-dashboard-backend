import { Injectable, Inject } from '@nestjs/common';
import { CASBIN_ENFORCER, TypesPrefix } from 'src/common/authz';
import { Enforcer } from 'casbin';

@Injectable()
export class UserVcService {
  constructor(
    @Inject(CASBIN_ENFORCER) private readonly enforcer: Enforcer
  ) { }

  public async listVcForUser(userId: number) {
    let vcPolicys = await this.enforcer.getPermissionsForUser(TypesPrefix.user + userId)
    const vcNames: string[] = []
    vcPolicys.forEach(p => {
      if (p && (p[1] === TypesPrefix.vc)) {
        vcNames.push(p[2]);
      }
    })
    console.log('vcNames', vcNames)
    return vcNames;
  }

  public async modifyUserVc(userId: string, vcNames: string[]) {
    userId = TypesPrefix.user + userId;
    await this.enforcer.deletePermissionsForUser(userId);
    vcNames.forEach((vcName) => {
      this.enforcer.addPermissionForUser(userId, TypesPrefix.vc,  vcName)
    })
  }

}
