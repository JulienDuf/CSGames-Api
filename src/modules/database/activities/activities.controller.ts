import { Body, Controller, Get, HttpException, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { STSService, UserModel } from '@polyhx/nest-services';
import { Permissions } from '../../../decorators/permission.decorator';
import { PermissionsGuard } from '../../../guards/permission.guard';
import { ValidationPipe } from '../../../pipes/validation.pipe';
import { Attendees } from '../attendees/attendees.model';
import { AttendeesService } from '../attendees/attendees.service';
import { CreateActivityDto } from './activities.dto';
import { Activities } from './activities.model';
import { ActivitiesService } from './activities.service';

@Controller("activity")
@UseGuards(PermissionsGuard)
export class ActivitiesController {
    constructor(private readonly activitiesService: ActivitiesService,
                private readonly attendeesService: AttendeesService,
                private readonly stsService: STSService) {
    }

    @Post()
    @Permissions('event_management:create:activity')
    async create(@Body(new ValidationPipe()) createActivityDto: CreateActivityDto) {
        await this.activitiesService.create(createActivityDto);
    }

    @Get()
    @Permissions('event_management:get-all:activity')
    async getAll(): Promise<Activities[]> {
        return await this.activitiesService.findAll();
    }

    @Put(':activity_id/:attendee_id/add')
    @Permissions('event_management:add-attendee:activity')
    async addAttendee(@Param('activity_id') activityId: string,
                      @Param('attendee_id') attendeeId: string): Promise<Activities> {
        let activity: Activities = await this.activitiesService.findById(activityId);

        if (!activity) {
            throw new HttpException(`Activity ${activityId} not found.`, HttpStatus.NOT_FOUND);
        }

        let attendee: Attendees = await this.attendeesService.findById(attendeeId);

        if (!attendee) {
            throw new HttpException(`Attendee ${attendeeId} not found.`, HttpStatus.NOT_FOUND);
        }

        if (activity.attendees.indexOf(attendeeId) > -1) {
            throw new HttpException(`Attendee ${attendeeId} is already a participant to activity ${activityId}.`,
                HttpStatus.EXPECTATION_FAILED);
        }

        activity.attendees.push(attendeeId);

        await activity.save();
        return activity;
    }

    @Get(':id/raffle')
    @Permissions('event_management:raffle:activity')
    async raffle(@Param('id') activityId: string): Promise<UserModel> {
        let activity: Activities = await this.activitiesService.findById(activityId);

        if (!activity) {
            throw new HttpException(`Activity ${activityId} not found.`, HttpStatus.NOT_FOUND);
        }

        let attendees: string[] = activity.attendees as string[];

        if (attendees.length === 0) {
            throw new HttpException(`Activity ${activityId} has no attendee.`, HttpStatus.EXPECTATION_FAILED);
        }

        let winnerId = this.getRandomIndex(attendees.length);

        let attendee = await this.attendeesService.findById(attendees[winnerId]);

        return (await this.stsService.getAllWithIds([attendee.userId])).users[0];
    }

    private getRandomIndex(size: number) {
        return Math.floor(Math.random() * Math.floor(size));
    }
}