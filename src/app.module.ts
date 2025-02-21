import {Logger, Module} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {ServeStaticModule} from "@nestjs/serve-static";
import { join } from 'path';
import { UiModule } from './ui/ui.module';
import {ConfigModule} from "@nestjs/config";
import { SequelizeModule } from '@nestjs/sequelize';
import {User} from "./db/user.model";
import { PiersModule } from './piers/piers.module';
import { RobotsModule } from './robots/robots.module';
import {DevtoolsModule} from "@nestjs/devtools-integration";
import {AppGateway} from "./app.gateway";
import { HarborModule } from './harbor/harbor.module';
import * as process from "process";
import {Robot} from "./db/robot";
import {AppLogws} from "./app.logws";
import {LogModule} from "./log/log.module";
import {Log} from "./db/log.model";
import {Credentials} from "./db/credentials.model";
import {SwarmModel} from "./db/swarm.model";
import {Images} from "./db/images.model";
import {SocketService} from "./harbor/socket.service";

@Module({
  controllers: [AppController],
  providers: [AppGateway, AppLogws, AppService ],
  exports: [AppService],
  imports: [
    ConfigModule.forRoot({isGlobal: true}),
    SequelizeModule.forRoot({
      dialect: 'postgres',
      host: process.env.DB_HOST,
      port: 5432,
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB,
      models: [User,  Robot, SwarmModel, Log, Credentials, Images],
      autoLoadModels: true,
      synchronize: true,
      sync: {
          alter: true
      }
    }),
    LogModule,
    UiModule,
    PiersModule,
    RobotsModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '../public'),
    }),
    DevtoolsModule.register({
      http: process.env.NODE_ENV !== 'production',
      port: 9330
    }),

    HarborModule],
})
export class AppModule {
    private readonly logger = new Logger(AppModule.name);

    constructor(private ser: AppService) {

    }
  onModuleInit() {
      this.logger.verbose(`The module has been initialized.`);
  }

}
