import {
    BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, UploadedFile, UseFilters, UseGuards
} from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { StorageService } from '@polyhx/nest-services';
import { Permissions } from '../../../decorators/permission.decorator';
import { User } from '../../../decorators/user.decorator';
import { CodeExceptionFilter } from '../../../filters/code-error/code.filter';
import { PermissionsGuard } from '../../../guards/permission.guard';
import { UserModel } from '../../../models/user.model';
import { ValidationPipe } from '../../../pipes/validation.pipe';
import { AddTokenDto, CreateAttendeeDto, UpdateAttendeeDto, UpdateNotificationDto } from './attendees.dto';
import { codeMap } from './attendees.exception';
import { CreateAttendeeGuard } from './attendees.guard';
import { Attendees } from './attendees.model';
import { AttendeesService } from './attendees.service';

@ApiUseTags('Attendee')
@Controller('attendee')
@UseGuards(PermissionsGuard)
@UseFilters(new CodeExceptionFilter(codeMap))
export class AttendeesController {
    constructor(private readonly attendeesService: AttendeesService,
                private readonly storageService: StorageService) {
    }

    @Post()
    @UseGuards(CreateAttendeeGuard)
    public async create(@UploadedFile() file, @User() user: UserModel,
                        @Body(new ValidationPipe()) value: CreateAttendeeDto): Promise<{ attendee: Attendees }> {
        if (file) {
            value.cv = await this.storageService.upload(file);
        }
        let attendee: Partial<Attendees> = value;
        attendee = Object.assign(attendee, { userId: user.id });
        return {
            attendee: await this.attendeesService.create(attendee)
                .then(this.appendCvMetadata.bind(this))
        };
    }

    @Get()
    @Permissions('csgames-api:get-all:attendee')
    public async getAll(): Promise<Attendees[]> {
        return await this.attendeesService.findAll();
    }

    @Get('info')
    @Permissions('csgames-api:get:attendee')
    public async getInfo(@User() user: UserModel): Promise<Attendees & { role: string; permissions: string[] }> {
        const attendee = await this.attendeesService.findOne({ email: user.username });
        if (!attendee) {
            throw new NotFoundException();
        }
        return {
            ...(await this.appendCvMetadata(attendee)),
            permissions: user.permissions,
            role: user.role
        };
    }

    @Get('cv/url')
    @Permissions('csgames-api:get:attendee')
    public async getCvUrl(@User() user: UserModel): Promise<{ url: string }> {
        const attendee = await this.attendeesService.findOne({ userId: user.id });
        if (attendee.cv) {
            return { url: await this.storageService.getDownloadUrl(attendee.cv) };
        } else {
            throw new BadRequestException('Attendee has no cv.');
        }
    }

    @Get(':id')
    @Permissions('csgames-api:get:attendee')
    public async getById(@Param('id') id: string): Promise<Attendees> {
        return await this.attendeesService.findOne({
            $or: [{
                publicId: id
            }, {
                userId: id
            }]
        });
    }

    @Put()
    @Permissions('csgames-api:update:attendee')
    public async update(@UploadedFile() file, @User() user: UserModel,
                        @Body(new ValidationPipe()) value: UpdateAttendeeDto) {
        await this.attendeesService.updateAttendeeInfo({
            email: user.username
        }, value, file);
    }

    @Put('token')
    @Permissions('csgames-api:update:attendee')
    public async addToken(@User() user: UserModel, @Body(ValidationPipe) dto: AddTokenDto) {
        await this.attendeesService.addToken(user.id, dto.token);
    }

    @Put('notification')
    @Permissions('csgames-api:update:attendee')
    public async updateNotification(@User() user: UserModel, @Body(ValidationPipe) dto: UpdateNotificationDto) {
        await this.attendeesService.updateNotification(user.id, dto);
    }

    @Delete('/token/:token')
    @Permissions('csgames-api:update:attendee')
    public async deleteToken(@User() user: UserModel, @Param('token') token) {
        await this.attendeesService.removeToken(user.id, token);
    }

    private async appendCvMetadata(a: Attendees) {
        const newAttendee = a.toJSON();

        if (!newAttendee.cv) {
            return newAttendee;
        }

        newAttendee['cv'] = await this.storageService.getMetadata(a.cv);
        return newAttendee;
    }
}
