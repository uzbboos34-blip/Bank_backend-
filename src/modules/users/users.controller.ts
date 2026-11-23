import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UsersService } from './users.service';

@ApiTags('Admin - Hodimlarni boshqarish')
@ApiBearerAuth('bearer')
@UseGuards(RolesGuard)
@Roles(Role.SUPER_ADMIN) // Faqat Super Admin foydalana oladi
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Super Admin: Yangi hodim qo\'shish' })
  @ApiResponse({ status: 201, description: 'Hodim muvaffaqiyatli yaratildi' })
  @ApiResponse({ status: 403, description: 'Faqat Super Administrator uchun' })
  @ApiResponse({ status: 409, description: 'Bunday loginli hodim allaqachon mavjud' })
  async createEmployee(@Body() dto: CreateEmployeeDto) {
    return this.usersService.createEmployee(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Super Admin: Barcha hodimlar ro\'yxati' })
  @ApiResponse({ status: 200, description: 'Hodimlar ro\'yxati va ulardagi qarzdorlar soni' })
  async getEmployees() {
    return this.usersService.getEmployees();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Super Admin: Bitta hodim tafsilotlari' })
  @ApiResponse({ status: 200, description: 'Hodim ma\'lumotlari' })
  @ApiResponse({ status: 404, description: 'Hodim topilmadi' })
  async getEmployee(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getEmployeeById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Super Admin: Hodim PIN kodini almashtirish, faolsizlantirish yoki tahrirlash' })
  @ApiResponse({ status: 200, description: 'Hodim muvaffaqiyatli yangilandi' })
  async updateEmployee(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.usersService.updateEmployee(id, dto);
  }
}
