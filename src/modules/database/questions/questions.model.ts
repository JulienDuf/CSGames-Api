import * as mongoose from "mongoose";

export enum QuestionTypes {
    Crypto = "crypto",
    Gaming = "gaming",
    Scavenger = "scavenger",
    Upload = "upload"
}

export enum ValidationTypes {
    String = "string",
    Regex = "regex",
    Function = "function",
    Upload = "upload"
}

export interface QuestionOption {
    contentTypes: string[];
}

export interface Questions extends mongoose.Document {
    _id: mongoose.Types.ObjectId;
    label: string;
    description: { [lang: string]: string };
    type: QuestionTypes;
    validationType: ValidationTypes;
    answer: any;
    score: number;
    option: QuestionOption;
}

export const QuestionsSchema = new mongoose.Schema({
    label: {
        type: String,
        required: true
    },
    description: {
        type: Object,
        required: true
    },
    type: {
        type: String,
        enum: ["crypto", "gaming", "scavenger", "upload"],
        required: true
    },
    validationType: {
        type: String,
        enum: ["string", "regex", "function", "upload"],
        required: true
    },
    answer: {
        type: Object,
        required: false
    },
    score: {
        type: Number,
        required: true
    },
    option: {
        type: Object,
        required: false
    }
});
