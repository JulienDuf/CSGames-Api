import {
    BadRequestException, Body, Controller, Delete, Get, Headers, NotFoundException, Param, Post, Put, UploadedFile,
    UseFilters, UseGuards
} from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { StorageService } from '@polyhx/nest-services';
import { Permissions } from '../../../decorators/permission.decorator';
import { CodeExceptionFilter } from '../../../filters/code-error/code.filter';
import { PermissionsGuard } from '../../../guards/permission.guard';
import { ValidationPipe } from '../../../pipes/validation.pipe';
import { Schools } from '../schools/schools.model';
import { SchoolsService } from '../schools/schools.service';
import { AddTokenDto, CreateAttendeeDto, UpdateAttendeeDto, UpdateNotificationDto } from './attendees.dto';
import { codeMap } from './attendees.exception';
import { AttendeesGuard, CreateAttendeeGuard } from './attendees.guard';
import { Attendees } from './attendees.model';
import { AttendeesService } from './attendees.service';

@ApiUseTags('Attendee')
@Controller('attendee')
@UseGuards(PermissionsGuard)
@UseFilters(new CodeExceptionFilter(codeMap))
export class AttendeesController {
    constructor(private readonly attendeesService: AttendeesService,
                private readonly schoolService: SchoolsService,
                private readonly storageService: StorageService) {
    }

    @Post()
    @UseGuards(CreateAttendeeGuard)
    public async create(@UploadedFile() file, @Headers('token-claim-user_id') userId: string,
            @Body(new ValidationPipe()) value: CreateAttendeeDto): Promise<{ attendee: Attendees }> {
        if (file) {
            value.cv = await this.storageService.upload(file);
        }
        let attendee: Partial<Attendees> = value;
        attendee = Object.assign(attendee, { userId, school: (await this.getSchool(value.school))._id });
        return {
            attendee: await this.attendeesService.create(attendee)
                .then(async a => {
                    return await a.populate({ path: 'school' }).execPopulate();
                }).then(this.appendCvMetadata.bind(this))
        };
    }

    @Get()
    @Permissions('event_management:get-all:attendee')
    public async getAll(): Promise<{ attendees: Attendees[] }> {
        return {
            attendees: await this.attendeesService.findAll()
        };
    }

    @Get('info')
    @UseGuards(AttendeesGuard)
    public async getInfo(@Headers('token-claim-user_id') userId: string): Promise<{ attendee: Attendees }> {
        const attendee = await this.attendeesService.findOne({ userId }, { path: 'school' });
        if (attendee) {
            return {
                attendee: await this.appendCvMetadata(attendee)
            };
        }
        return {
            attendee: attendee
        };
    }

    @Get('cv/url')
    @UseGuards(AttendeesGuard)
    public async getCvUrl(@Headers('token-claim-user_id') userId: string): Promise<{ url: string }> {
        let attendee = await this.attendeesService.findOne({ userId });
        if (attendee.cv) {
            return { url: await this.storageService.getDownloadUrl(attendee.cv) };
        } else {
            throw new BadRequestException('Attendee has no cv.');
        }
    }

    @Get(':id')
    @Permissions('event_management:get:attendee')
    public async getByPublicId(@Param('id') id: string): Promise<{ attendee: Attendees }> {
        return {
            attendee: await this.attendeesService.findOne({
                publicId: id
            })
        };
    }

    @Get('user/:userId')
    @Permissions('event_management:get:attendee')
    public async getByUserId(@Param('userId') userId: string): Promise<{ attendee: Attendees }> {
        return {
            attendee: await this.attendeesService.findOne({
                userId: userId
            })
        };
    }

    @Put()
    @UseGuards(AttendeesGuard)
    public async update(@UploadedFile() file, @Headers('token-claim-user_id') userId: string,
            @Body(new ValidationPipe()) value: UpdateAttendeeDto): Promise<{ attendee: Attendees }> {
        if (file) {
            const previousCv = (await this.attendeesService.findOne({ userId })).cv;
            if (previousCv) {
                await this.storageService.delete(previousCv);
            }
            value.cv = await this.storageService.upload(file);
        } else if (value.cv === 'null') {
            const attendee = await this.attendeesService.findOne({ userId });
            if (attendee.cv) {
                await this.storageService.delete(attendee.cv);
            }
            value.cv = null;
        } else {
            delete value.cv;
        }
        const attendee: Partial<Attendees> = value;
        if (value.school) {
            attendee.school = (await this.getSchool(value.school))._id;
        }
        return {
            attendee: await this.attendeesService.update({ userId }, attendee)
                .then(async a => {
                    return await this.attendeesService.findOne({ userId }, { path: 'school' });
                }).then(this.appendCvMetadata.bind(this))
        };
    }

    @Put('/token')
    @Permissions('event_management:update:attendee')
    @UseGuards(AttendeesGuard)
    public async addToken(@Headers('token-claim-user_id') userId: string, @Body(ValidationPipe) dto: AddTokenDto) {
        await this.attendeesService.addToken(userId, dto.token);
    }

    @Put('/notification')
    @Permissions('event_management:update:attendee')
    @UseGuards(AttendeesGuard)
    public async updateNotification(@Headers('token-claim-user_id') userId: string,
                             @Body(ValidationPipe) dto: UpdateNotificationDto) {
        await this.attendeesService.updateNotification(userId, dto);
    }

    @Put(':attendee_id/public_id/:public_id')
    @Permissions('event_management:set-public-id:attendee')
    public async setPublicId(@Param('attendee_id') attendeeId: string, @Param('public_id') publicId: string): Promise<Attendees> {
        const attendee: Attendees = await this.attendeesService.findById(attendeeId);

        if (!attendee) {
            throw new NotFoundException(`Attendee ${attendeeId} not found.`);
        }

        attendee.publicId = publicId;

        await attendee.save();

        return attendee;
    }

    @Delete('/token/:token')
    @Permissions('event_management:update:attendee')
    @UseGuards(AttendeesGuard)
    public async deleteToken(@Headers('token-claim-user_id') userId: string, @Param('token') token) {
        await this.attendeesService.removeToken(userId, token);
    }

    private async getSchool(name: string) {
        let school: Schools;
        try {
            school = await this.schoolService.findOne({name});
        } catch (err) {
            throw new BadRequestException('School Invalid');
        }

        if (!school) {
            throw new BadRequestException('School Invalid');
        }

        return school;
    }

    private async appendCvMetadata(a: Attendees) {
        if (!a.cv) {
            return a;
        }
        let newAttendee = a.toObject();
        newAttendee['cv'] = await this.storageService.getMetadata(a.cv);
        return newAttendee;
    }
}