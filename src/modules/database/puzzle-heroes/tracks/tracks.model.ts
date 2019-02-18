import { PuzzleGraphNodes, PuzzleGraphNodesSchema } from '../puzzle-graph-nodes/puzzle-graph.nodes.model';
import * as mongoose from "mongoose";

export enum TrackTypes {
    Crypto = "crypto",
    Gaming = "gaming",
    Scavender = "scavenger",
    Sponsor = "sponsor"
}

export interface Tracks extends mongoose.Document {
    _id: mongoose.Types.ObjectId;
    label: string;
    type: TrackTypes;
    puzzles: PuzzleGraphNodes[];
    releaseDate: Date;
}

export const TracksSchema = new mongoose.Schema({
    label: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ["crypto", "gaming", "scavenger", "sponsor"],
        required: true
    },
    puzzles: {
        type: [PuzzleGraphNodesSchema],
        required: true
    },
    releaseDate: {
        type: Date,
        required: true
    }
});
