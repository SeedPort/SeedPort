import {BelongsTo, BelongsToMany, Column, Index, Model, NotNull, Table} from "sequelize-typescript";
import {IPier} from "../models/pier/types";
import {BotType, IRobot, ISourceInfo} from "../models/robot/types";
import {Pier} from "./pier.model";
import {Sequelize} from "sequelize";
import {ISwarm} from "../../client/src/models/swarm/ISwarm";
import {SwarmModel} from "./swarm.model";

@Table
export class Robot extends Model implements IRobot {
    // Primary key
    @Column({primaryKey: true, autoIncrement: true})
    id: number;

    @Column({})
    name: string;

    @Column({})
    @Index({
        name: "robotid",
    })
    identifier: string;

    @Column({})
    lastSeenAt: Date;

    @Column({})
    status: string;

    @Column({})
    type: BotType;

    @Column({
        type: "json"
    })
    source: any;

    @Column({
        type: "json"
    })
    sourceInfo: ISourceInfo;

    @Column({})
    pierId: number;

    @Column({
        type: "json"
    } )
    runner: any;

    @Column({
        type: "json"
    })
    config: string;

    @Column({})
    enabled: boolean;

    @Column({})
    swarmID: number;

    @BelongsTo(() => SwarmModel, 'swarmID')
    swarm: ISwarm;

    @Column({
        type: "json"
    } )
    windowJson: string;

}