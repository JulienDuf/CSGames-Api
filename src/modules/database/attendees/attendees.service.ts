import { InjectModel } from "@nestjs/mongoose";
import { DocumentQuery, Model } from 'mongoose';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Attendees } from "./attendees.model";
import { BaseService } from "../../../services/base.service";
import { CreateAttendeeDto, UpdateNotificationDto } from './attendees.dto';
import { DataTableModel, DataTableReturnModel } from "../../../models/data-table.model";
import { Schools } from "../schools/schools.model";
import { SchoolsService } from "../schools/schools.service";
import { STSService } from "@polyhx/nest-services";
import * as mongoose from 'mongoose';

interface AttendeeDtInterface extends Attendees {
    email: string;
    firstName: string;
    lastName: string;
    birthDate: string;
}

@Injectable()
export class AttendeesService extends BaseService<Attendees, CreateAttendeeDto> {
    constructor(@InjectModel("attendees") private readonly attendeesModel: Model<Attendees>,
                private readonly schoolService: SchoolsService,
                private readonly stsService: STSService) {
        super(attendeesModel);
    }

    public async filterFrom(attendeeIds: string[], dtObject: DataTableModel,
            filter: { school: string[] }): Promise<DataTableReturnModel> {
        let query: DocumentQuery<Attendees[], Attendees, {}>;
        if (filter.school.length > 0) {
            query = this.attendeesModel.find({
                $and: [{
                    _id: { $in: attendeeIds }
                }, {
                    school: { $in: filter.school }
                }]
            });
        } else {
            query = this.attendeesModel.find({
                $and: [{
                    _id: { $in: attendeeIds }
                }]
            });
        }

        let data: DataTableReturnModel = <DataTableReturnModel> {
            draw: dtObject.draw,
            recordsTotal: await query.countDocuments().exec()
        };

        let attendees = await query.find()
            .populate({ path: 'school' })
            .limit(dtObject.length)
            .skip(dtObject.start)
            .exec();

        let result = attendees.map(v => {
            let a: Partial<AttendeeDtInterface> = v.toJSON();
            a.school = v.school ? (<Schools>v.school).name : "";

            return <AttendeeDtInterface>a;
        });

        if (result.length > 0) {
            await this.getAttendeesUser(result);
        }

        data.data = result;
        data.recordsFiltered = data.recordsTotal;

        return data;
    }

    public async addToken(userId: string, token: string): Promise<Attendees> {
        const attendee = await this.findOne({
            userId: userId
        });

        if (!attendee) {
            throw new NotFoundException('Attendee not found');
        }

        if (attendee.messagingTokens.indexOf(token) >= 0) {
            throw new BadRequestException('Token already exist');
        }

        return this.attendeesModel.updateOne({
            userId: userId
        }, {
            $push: {
                messagingTokens: token
            }
        });
    }

    public async removeToken(userId: string, token: string): Promise<Attendees> {
        const attendee = await this.findOne({
            userId: userId
        });

        if (!attendee) {
            throw new NotFoundException('Attendee not found');
        }

        if (attendee.messagingTokens.indexOf(token) < 0) {
            throw new BadRequestException("Token doesn't exist");
        }

        return this.attendeesModel.updateOne({
            userId: userId
        }, {
            $pull: {
                messagingTokens: token
            }
        });
    }

    public async updateNotification(userId: string, dto: UpdateNotificationDto): Promise<Attendees> {
        const attendee = await this.findOne({
            userId: userId
        });

        if (!attendee) {
            throw new NotFoundException('Attendee not found');
        }

        if (!attendee.notifications
            .find(x => (x.notification as mongoose.Types.ObjectId).toHexString() === dto.notification)) {
            throw new NotFoundException('Notification not found');
        }

        return this.attendeesModel.updateOne({
            userId: userId,
            "notifications.notification": dto.notification
        }, {
            "notifications.$.seen": dto.seen
        });
    }

    private async getAttendeesUser(attendees: AttendeeDtInterface[]) {
        let ids = attendees.map(v => v.userId);
        let users = (await this.stsService.getAllWithIds(ids)).users;

        for (let attendee of attendees) {
            let user = users[users.findIndex(value => (<any>value).id === attendee.userId)];
            if (user) {
                attendee.firstName = user.firstName;
                attendee.lastName = user.lastName;
                attendee.email = user.username;
                attendee.birthDate = user.birthDate;
            } else {
                attendee.firstName = attendee.firstName = attendee.email = attendee.birthDate = "";
            }
        }
    }
}