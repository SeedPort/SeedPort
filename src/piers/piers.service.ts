import {forwardRef, Inject, Injectable, Logger} from '@nestjs/common';
import {IRobot} from "../models/robot/types";
import {Images} from "../db/images.model";
import * as k8s from '@kubernetes/client-node';
import {IRoboShellValidationResult} from "../models/harbor/types";
import {InjectModel} from "@nestjs/sequelize";
import {MessageBuilder, SocketService} from "../harbor/socket.service";

export interface IDeploymentWithRobot{
    deployment: {
        metadata: {
            name: string
        }
    },
    robot: {
        id: string,
        pod_id?: string
    }

}

@Injectable()
export class PiersService {
    private readonly logger = new Logger(PiersService.name);
    private kubeClientApi: any;
    private kubeClientAppBatch: any;
    private kubeClientAppApi: any;

    constructor(
        @Inject(forwardRef(() => SocketService))
        private socketService: SocketService,
        @InjectModel(Images)
        private imageModel: typeof Images,
    ) {
    }

    // on start
    onModuleInit() {
        this.logger.log('PierServiceService has been initialized.');

        this.startPierService();
        setInterval(() => {
            this.startPierService();
        }, 20000);
    }

    getAllRoboHarborDeployments() {
        return new Promise<any[]>((resolve, reject) => {
            const list: any[] = [];
            this.logger.log('Getting all Robo Harbor Deployments');
            // Find all pods with the label appControlledBy=roboharbor
            this.kubeClientApi
                .listPodForAllNamespaces()
                .then((res: any) => {
                    const pods = res.body.items;
                    for (const pod of pods) {
                        if (pod.metadata.labels.appControlledBy === 'roboharbor') {
                            list.push(pod)
                        }
                    }
                }).catch((err: any) => {
                    this.logger.error(err);
                    reject(err);
                });
            return resolve(list);
        });
    }

    createJob(namespace: string, jobData: any) {
        return new Promise((resolve, reject) => {
            if (process.env.DEV_KUBERNETES !== 'development') {
                this.kubeClientAppBatch.createNamespacedJob(namespace, jobData).then((res: any) => {
                    resolve(res);
                }).catch((err: any) => {
                    reject(err);
                });
            }
            else {
                this.logger.debug(' Create job by yourself', JSON.stringify(jobData));

                return resolve({
                    body: {
                        metadata: {
                            name: 'test'
                        }
                    }
                })
            }
        });
    }

    createDeployement(namespace: string, deployment: any) {
        return new Promise((resolve, reject) => {
            if (process.env.DEV_KUBERNETES !== 'development') {
                this.kubeClientAppApi.createNamespacedDeployment(namespace, deployment).then((res: any) => {
                    resolve(res);
                }).catch((err: any) => {
                    reject(err);
                });
            }
            else {
                this.logger.debug(' Create deployment by yourself', JSON.stringify(deployment));
                
                return resolve({
                    body: {
                        metadata: {
                            name: 'test'
                        }
                    }
                })
            }
        });
    }

    startRobotJob(robot: IRobot) : Promise<IDeploymentWithRobot> {
        return new Promise<IDeploymentWithRobot>(async (resolve, reject) => {
            try {
                this.logger.log('Starting Robot Job');
                const image = await this.imageModel.findOne({where: {name: robot.image.name}});
                const deployment = {
                    apiVersion: 'batch/v1',
                    kind: 'Job',
                    metadata: {
                        name: robot.identifier,
                        labels: {
                            appControlledBy: 'roboharbor',
                            robotId: robot.id.toString()
                        }
                    },
                    spec: {
                        replicas: 1,
                        template: {
                            metadata: {
                                labels: {
                                    appControlledBy: 'roboharbor',
                                    robotId: robot.id.toString()
                                }
                            }, 
                            spec: {
                                restartPolicy: 'Never',
                                containers: [
                                    {
                                        env: [
                                            ...this.getEnvironmentVariables(robot),
                                        ],
                                        name: 'robot',
                                        image: image.imageContainerName + ':latest'
                                    }
                                ]
                            }
                        }
                    }
                };
                this.createJob('default', deployment).then((resDepl: any) => {
                    this.logger.log('Job Created');
                    this.logger.log(resDepl);
                    this.socketService.waitForRobotRegistration(robot.identifier)
                        .then((res: any) => {
                            this.logger.log('Robot Registered');
                            this.logger.log(res);
                            resolve({
                                deployment: {
                                    metadata: {
                                        name: resDepl.body.metadata.name
                                    }
                                },
                                robot: {
                                    pod_id: res.pod_id,
                                    id: robot.identifier
                                }
                            });
                        })
                        .catch((err) => {
                            reject(err);

                        })
                }).catch((err: any) => {
                    this.logger.error(err);
                    reject(err);
                });
            } catch (err) {
                this.logger.error(err);
                reject(err);
            }
        });
    }

    getEnvironmentVariables(robot: IRobot) {
        return [
            {
                name: 'ROBO_ID',
                value: robot.identifier.toString()
            },
            {
                name: 'ROBO_HARBOR',
                value: 'roboharbor:5001'
            },
            {
                name: 'ROBO_SECRET',
                value: "secret"
            },
            {
                name: 'POD_NAME',
                valueFrom: {fieldRef: {fieldPath: "metadata.name"}}
            }
        ];
    }

    startRobotDeployment(robot: IRobot, waitTillStarted: boolean = true) : Promise<IDeploymentWithRobot> {
        return new Promise<IDeploymentWithRobot>(async (resolve, reject) => {
            try {
                this.logger.log('Starting Robot Deployment');
                const image = await this.imageModel.findOne({where: {name: robot.image.name}});
                const deployment = {
                    apiVersion: 'apps/v1',
                    kind: 'Deployment',
                    metadata: {
                        name: robot.identifier,
                        labels: {
                            appControlledBy: 'roboharbor',
                            robotId: robot.id.toString()
                        }
                    },
                    spec: {
                        replicas: 1,
                        selector: {
                            matchLabels: {
                                appControlledBy: 'roboharbor',
                                robotId: robot.id.toString()
                            }
                        },
                        template: {
                            metadata: {
                                labels: {
                                    appControlledBy: 'roboharbor',
                                    robotId: robot.id.toString()
                                }
                            },
                            spec: {
                                containers: [
                                    {
                                        name: 'robot',
                                        image: image.imageContainerName+':'+(image.version || 'latest'),
                                        env: [
                                            ...this.getEnvironmentVariables(robot),
                                        ],
                                    }
                                ]
                            }
                        }
                    }
                };
                this.createDeployement('default', deployment).then((resDepl: any) => {
                    this.logger.log('Deployment Created');
                    this.logger.log(resDepl);
                    if (waitTillStarted) {
                       this.socketService.waitForRobotRegistration(robot.identifier)
                           .then((res: any) => {
                                this.logger.log('Robot Registered');
                                this.logger.log(res);
                               resolve({
                                   deployment: {
                                       metadata: {
                                           name: resDepl.body.metadata.name
                                       }
                                   },
                                   robot: {
                                       pod_id: res.pod_id,
                                       id: robot.identifier
                                   }
                               });
                        })
                       .catch((err)=> {
                           reject(err);

                       })
                    }
                    else {
                        resolve({
                            deployment: {
                                metadata: {
                                    name: resDepl.body.metadata.name
                                }
                            },
                            robot: {
                                id: robot.identifier
                            }
                        });
                    }
                }).catch((err: any) => {
                    this.logger.error(err);
                    reject(err);
                });
            }
            catch(err) {
                this.logger.error(err);
                reject(err);
            }
        });
    }

    startPierService() {
        return new Promise((resolve, reject) => {
            try {
                this.logger.log('Starting Pier Service');
                if (process.env.NODE_ENV !== 'development') {
                    this.logger.log('Loading from Cluster');
                    const kc = new k8s.KubeConfig();
                    kc.loadFromCluster();
                    this.kubeClientApi = kc.makeApiClient(k8s.CoreV1Api);
                    this.kubeClientAppApi = kc.makeApiClient(k8s.AppsV1Api);
                    this.kubeClientAppBatch = kc.makeApiClient(k8s.BatchV1Api);
                }
                else {
                    this.logger.log('Loading from Local files');
                    const kc = new k8s.KubeConfig();
                    kc.loadFromDefault();
                    this.kubeClientApi = kc.makeApiClient(k8s.CoreV1Api);
                    this.kubeClientAppApi = kc.makeApiClient(k8s.AppsV1Api);
                    this.kubeClientAppBatch = kc.makeApiClient(k8s.BatchV1Api);
                }

                const currentRoboHarborDeployments = this.getAllRoboHarborDeployments();
                currentRoboHarborDeployments.then((res: any) => {
                    this.logger.log('All Robo Harbor Deployments:');
                    this.logger.log(res);
                }).catch((err: any) => {
                    this.logger.error(err);
                    reject(err);
                });
            }
            catch(err) {
                this.logger.error(err);
                reject(err);
            }
        });
    }

    validateRobot(bot: IRobot) : Promise<IRoboShellValidationResult> {
        return new Promise<IRoboShellValidationResult>((resolve, reject) => {
            try {
                bot.image = {
                    name: "validate-robot",
                    version: "latest"
                }
                let returnedRobot = null;
                return this.startRobotJob(bot).then((res: any) => {
                    this.logger.log('Robot Deployment Started');
                    this.logger.log(res);
                    return this.socketService.sendMessageToRobotWithResponse(res.robot.id,
                        MessageBuilder.validateRobotMessage(bot),
                        60000)
                        .then((resVal: any) => {
                            this.logger.debug('Robot Validation Response')
                            this.logger.debug(resVal);
                            if (resVal) {
                                if (resVal.success === false) {
                                    return resolve({
                                        source: false,
                                        isError: true,
                                        error: resVal.error
                                    } as IRoboShellValidationResult);

                                }
                                else {
                                    return resolve({
                                        source: true
                                    } as IRoboShellValidationResult);
                                }
                            }
                            else {
                                return reject('No response from robot');
                            }

                        })
                        .catch((err)=> {
                            this.logger.error(err);
                            reject(err);

                        })
                })
                .catch((err: any) => {
                    this.logger.error(err);
                    reject(err);
                })
                .finally(() => {
                    this.logger.log('Robot Deployment Started');
                });

            }
            catch(err) {
                this.logger.error(err);
                reject(err);
            }
        });
    }
}
