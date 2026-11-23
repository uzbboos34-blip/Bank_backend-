import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { CurrentUserPayload } from 'src/common/types/user';
import { StatsService } from './stats.service';

@ApiTags('Stats')
@ApiBearerAuth('bearer')
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('today')
  @ApiOperation({ summary: 'Bugungi qisqa statistika (total, visited, promised, paid)' })
  async getTodayStats(@CurrentUser() user: CurrentUserPayload) {
    return this.statsService.getTodayStats(user.id);
  }

  @Get('report')
  @ApiOperation({ summary: 'Batafsil Hisobot (Screenshot 3 talabi: Bugun, Hafta, Oy)' })
  async getDetailedReport(
    @CurrentUser() user: CurrentUserPayload,
    @Query('period') period?: 'bugun' | 'hafta' | 'oy',
  ) {
    return this.statsService.getDetailedReport(user.id, period || 'bugun');
  }
}
