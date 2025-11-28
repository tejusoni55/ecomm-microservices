// infra/pulumi/index.ts
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as AWS from "aws-sdk";

const cfg = new pulumi.Config();
const clusterName = cfg.require("ecsClusterName"); // e.g. 'excited-koala-gagdmc'
const region = cfg.get("awsRegion") || aws.config.region || "ap-south-1";

// services config: optional; example shape:
// {
//   "users": { "containerName": "users-container" },
//   "products": { "containerName": "products-container" }
// }
const servicesToUpdate =
  cfg.getObject<Record<string, { containerName: string }>>("services") || {};

// images config (set in CI or locally before running pulumi up):
// { "users": "12345.dkr.ecr.../users:sha", ... }
const images = cfg.getObject<Record<string, string>>("images") || {};

AWS.config.update({ region });

/** Replace image in a containerDefinitions array (not JSON). */
function replaceImageInContainerDefs(
  containerDefs: AWS.ECS.ContainerDefinition[],
  containerName: string,
  newImage: string
): AWS.ECS.ContainerDefinition[] {
  const copy = JSON.parse(
    JSON.stringify(containerDefs)
  ) as AWS.ECS.ContainerDefinition[];
  const found = copy.find((c) => c.name === containerName);
  if (!found) {
    throw new Error(
      `container '${containerName}' not found in containerDefinitions`
    );
  }
  found.image = newImage;
  return copy;
}

async function updateServiceImage(
  ecs: AWS.ECS,
  serviceName: string,
  containerName: string,
  newImage: string
) {
  pulumi.log.info(`Updating service ${serviceName} -> image ${newImage}`);

  // 1) describe service
  const svcResp = await ecs
    .describeServices({ cluster: clusterName, services: [serviceName] })
    .promise();
  if (!svcResp.services || svcResp.services.length === 0) {
    throw new Error(
      `Service '${serviceName}' not found in cluster '${clusterName}'`
    );
  }
  const svc = svcResp.services[0];
  const currentTaskDefArn = svc.taskDefinition;
  if (!currentTaskDefArn)
    throw new Error(`Service ${serviceName} has no taskDefinition`);

  // 2) describe task definition
  const tdResp = await ecs
    .describeTaskDefinition({ taskDefinition: currentTaskDefArn })
    .promise();
  if (!tdResp.taskDefinition)
    throw new Error(`TaskDefinition '${currentTaskDefArn}' not found`);
  const td = tdResp.taskDefinition;

  // 3) create new container definitions with only image changed
  if (!td.containerDefinitions)
    throw new Error(
      `TaskDefinition ${currentTaskDefArn} has no containerDefinitions`
    );
  const newContainerDefs = replaceImageInContainerDefs(
    td.containerDefinitions as AWS.ECS.ContainerDefinition[],
    containerName,
    newImage
  );

  // 4) register new task definition (preserve relevant fields)
  const registerParams: AWS.ECS.RegisterTaskDefinitionRequest = {
    family: td.family!,
    taskRoleArn: td.taskRoleArn,
    executionRoleArn: td.executionRoleArn,
    networkMode: td.networkMode,
    cpu: td.cpu,
    memory: td.memory,
    requiresCompatibilities: td.requiresCompatibilities,
    placementConstraints: td.placementConstraints,
    volumes: td.volumes,
    containerDefinitions: newContainerDefs,
  };

  const newTd = await ecs.registerTaskDefinition(registerParams).promise();
  const newTaskDefArn = newTd.taskDefinition?.taskDefinitionArn;
  if (!newTaskDefArn) throw new Error("Failed to register new task definition");

  pulumi.log.info(`Registered new taskDefinition: ${newTaskDefArn}`);

  // 5) update ECS service to use new task definition
  await ecs
    .updateService({
      cluster: clusterName,
      service: serviceName,
      taskDefinition: newTaskDefArn,
    })
    .promise();

  pulumi.log.info(
    `Updated service ${serviceName} to taskDefinition ${newTaskDefArn}`
  );
  return newTaskDefArn;
}

async function main() {
  const ecs = new AWS.ECS({ region });

  const tasks: Promise<any>[] = [];

  for (const svcName of Object.keys(servicesToUpdate)) {
    const cfgEntry = servicesToUpdate[svcName];
    const containerName = cfgEntry.containerName;
    const imageForService = images[svcName];
    console.log(`images: ${JSON.stringify(images)}`,svcName);
    if (!imageForService) {
      pulumi.log.info(
        `No image configured for service '${svcName}'; skipping.`
      );
      continue;
    }
    tasks.push(
      updateServiceImage(ecs, svcName, containerName, imageForService)
    );
  }

  // Wait for all updates to finish
  const results = await Promise.all(tasks);
  return results;
}

// Export an Output so Pulumi waits for the async work to complete.
export const result = pulumi.output(main());
