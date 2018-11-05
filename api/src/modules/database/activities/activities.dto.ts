import { ApiModelProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateActivityDto {

    @IsString()
    @IsNotEmpty()
    @ApiModelProperty({ required: true })
    name: string;

    @IsNotEmpty()
    @ApiModelProperty({ required: true })
    beginDate: string;

    @IsNotEmpty()
    @ApiModelProperty({ required: true })
    endDate: string;

    @IsString()
    @IsNotEmpty()
    @ApiModelProperty({ required: true })
    location: string;

    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @ApiModelProperty()
    attendees: string[];
}