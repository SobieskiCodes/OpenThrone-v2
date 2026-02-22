import { Controller, Get, Patch, Body } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import { SettingsService } from './settings.service';
import { PermissionType } from '@openthrone/shared';

@Controller('admin/settings')
@Roles(PermissionType.ADMINISTRATOR)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /**
   * Get all game settings
   */
  @Get()
  async getSettings() {
    return this.settingsService.getAllSettings();
  }

  /**
   * Update multiple settings at once
   */
  @Patch()
  async updateSettings(
    @CurrentPlayer() player: any,
    @Body() body: { settings: Array<{ key: string; value: any }> },
  ) {
    for (const setting of body.settings) {
      await this.settingsService.updateSetting(
        setting.key,
        setting.value,
        undefined,
        player.id,
      );
    }

    return { message: 'Settings updated successfully' };
  }
}
