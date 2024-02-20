import {Inject, Injectable, Logger} from '@nestjs/common';
import {UserData} from "../models/auth/types";
import {InjectModel} from "@nestjs/sequelize";
import {User} from "../db/user.model";
import {RunnerPackage} from "../db/runnerpackage.model";
const {createHash} = require('crypto');


// Development User
let users: UserData[] = [
    {
        email: 'admin@roboharbor.de',
        username: 'test',
        password: '9cca0703342e24806a9f64e08c053dca7f2cd90f10529af8ea872afb0a0c77d4',
        firstName: 'Test',
        lastName: 'User',
        role: 'Admin',
        token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJjb2RlcnRoZW1lcyIsImlhdCI6MTU4NzM1NjY0OSwiZXhwIjoxOTAyODg5NDQ5LCJhdWQiOiJjb2RlcnRoZW1lcy5jb20iLCJzdWIiOiJzdXBwb3J0QGNvZGVydGhlbWVzLmNvbSIsImxhc3ROYW1lIjoiVGVzdCIsIkVtYWlsIjoic3VwcG9ydEBjb2RlcnRoZW1lcy5jb20iLCJSb2xlIjoiQWRtaW4iLCJmaXJzdE5hbWUiOiJIeXBlciJ9.P27f7JNBF-vOaJFpkn-upfEh3zSprYfyhTOYhijykdI',
    },
];

@Injectable()
export class UiService {

    private readonly logger = new Logger(UiService.name);

    constructor(
        @InjectModel(User)
        private userModel: typeof User,
        @InjectModel(RunnerPackage)
        private runnerPackageModel: typeof RunnerPackage,
    ) {
    }
    login(email: string, password: string) {
        // Create a "token" with the sha of password
        const result = createHash('sha256').update("bacon").digest('hex');
       return this.userModel.findOne({where: {email, password: result}});
    }

    async initializeDatabase() {
        this.logger.log("Initializing database");
        const user = await this.userModel.findOne();
        if (!user) {
            await this.userModel.bulkCreate(users);
        }

        const basicPackages = [
            {
                name: "shell",
                description: "Shell Runner",
                version: "1.0.9",
                attributes: [
                    {
                        name: "command",
                        type: "string"
                    }
                ],
                parameters: true,
                environmentVariables: true,
                title: "Shell Command",
                logo: "https://cdn.icon-icons.com/icons2/2367/PNG/512/terminal_shell_icon_143501.png",
                executionShellCommand: "bash",
            },
            {
                name: "node",
                description: "Node JS",
                version: "1.0.5",
                title: "Node JS",
                attributes: [
                    {
                        name: "nodeVersion",
                        type: "enum",
                        values: [
                            {
                                value: "14",
                                label: "14"
                            },
                            {
                                value: "12",
                                label: "12"
                            },
                            {
                                value: "10",
                                label: "10"
                            },
                            {
                                value: "16",
                                label: "16"
                            },
                            {
                                value: "20",
                                label: "20"
                            },
                            {
                                value: "18",
                                label: "18"
                            }
                        ]
                    }
                ],
                parameters: true,
                environmentVariables: true,
                logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Node.js_logo.svg/1200px-Node.js_logo.svg.png",
                executionShellCommand: "node",
                shellCommandForPackageInstallation: "apt-get install nvm -y",
            },
            {
                name: "python",
                description: "Python script",
                title: "Python",
                version: "1.0.8",
                attributes: [
                    {
                        name: "pythonVersion",
                        type: "enum",
                        values: [
                            {
                                value: "3.9",
                                label: "3.9"
                            },
                            {
                                value: "3.8",
                                label: "3.8"
                            },
                            {
                                value: "3.7",
                                label: "3.7"
                            },
                            {
                                value: "3.6",
                                label: "3.6"
                            }
                        ]
                    },
                    {
                        name: "script",
                        type: "robo_file",
                        label: "Python Script"
                    }
                ],
                parameters: true,
                environmentVariables: true,
                executionShellCommand: "python3",
                logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Python-logo-notext.svg/1200px-Python-logo-notext.svg.png",
                shellCommandForPackageInstallation: "apt-get install python3 -y",
            }

        ]

        const packages = await this.runnerPackageModel.findAll();
        if (packages.length === 0) {
            for (const basicPackage of basicPackages) {
                await this.runnerPackageModel.create(basicPackage);
            }
        }
        else {
            // Compare all versions and update if necessary
            for (const basicPackage of basicPackages) {
                const packageToUpdate = packages.find((p) => p.name === basicPackage.name);
                if (packageToUpdate) {
                    if (packageToUpdate.version !== basicPackage.version) {
                        await packageToUpdate.update(basicPackage);
                    }
                }
            }
        }
    }
}
