const express = require('express')
const { generateSlug } = require('random-word-slugs')
const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs')
const { Server } = require('socket.io')
const Redis = require('ioredis')
const cors = require('cors');
//second part
const { PrismaClient } = require('@prisma/client')
const { createClient } = require('@clickhouse/client')
const { Kafka } = require('kafkajs')
const { v4: uuidv4 } = require('uuid')
const { z } = require('zod')
const fs = require('fs')
const path = require('path')


const app = express()
const PORT = 9000
app.use(cors());
const prisma = new PrismaClient({})

//first part
//const subscriber = new Redis('redis://default:AVNS_x4mJahn3ffn-xGtXAOB@valkey-6875c2f-bittukumar8083a-3189.j.aivencloud.com:10152')

const io = new Server({ cors: '*' })

//clickhouse client
const client = createClient({
    host: 'https://clickhouse-316600d1-vercel-build.c.aivencloud.com:27975',
    database: 'default',
    username: 'avnadmin',
    password: 'AVNS__k4JZmoTp0lyyg7X-NU'
})

//kafka 

const kafka = new Kafka({
    clientId: `api-server`,
    brokers: ['kafka-22305247-vercel-build.e.aivencloud.com:27987'],
    ssl: {
        ca: [fs.readFileSync(path.join(__dirname, 'kafka.pem'), 'utf-8')]
    },
    sasl: {
        username: 'avnadmin',
        password: 'AVNS_ILmG38748lIngdg81_r',
        mechanism: 'plain'
    }

})
const consumer = kafka.consumer({ groupId: 'api-server-logs-consumer' })

//ye woh jb new connection aata h tho bolo kis channel pr subscribe krna h uspr krwas dega
io.on('connection', socket => {
    socket.on('subscribe', channel => {
        socket.join(channel)
        //message event pr subscribe kr rhe h
        socket.emit('message', `Joined ${channel}`)
    })
})

io.listen(9002, () => console.log('Socket Server 9002'))

const ecsClient = new ECSClient({
    region: 'ap-south-1',
     credentials: {
        accessKeyId: 'AKIAVANY3YXMLR5V7UGX',
        secretAccessKey: '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'
    }
})

const config = {
    CLUSTER: 'arn:aws:ecs:ap-south-1:344521950680:cluster/builder-cluster',
    TASK: 'arn:aws:ecs:ap-south-1:344521950680:task-definition/builder-task'
}

app.use(express.json())

//todo: validate the user authenticate from the user table do if you want to add authentication

//second part
//iss project ke andar deployment ko trigger kr skta h user
app.post('/project', async (req, res) => {
    const schema = z.object({
        name: z.string(),
        gitURL: z.string()
    })
    //todo:implement some regex such that it can validate that it is  a git url
    const safeParseResult = schema.safeParse(req.body)

    if (safeParseResult.error) return res.status(400).json({ error: safeParseResult.error })

    const { name, gitURL } = safeParseResult.data

    const project = await prisma.project.create({
        data: {
            name,
            gitURL,
            subDomain: generateSlug()
        }
    })

    return res.json({ status: 'success', data: { project } })

})

//firstly its name is /project but second part i have changed to /deploy
app.post('/deploy', async (req, res) => {
    //todo validate ki this project is created by this user only so he can deploy it
    //first part
    // const { gitURL, slug } = req.body
    // const projectSlug = slug ? slug : generateSlug()


    //second part


    const { projectId } = req.body

    const project = await prisma.project.findUnique({ where: { id: projectId } })

    if (!project) return res.status(404).json({ error: 'Project not found' })

    // todo:Check if there is no running deployement not in progress,queue
    const deployment = await prisma.deployement.create({
        data: {
            project: { connect: { id: projectId } },
            status: 'QUEUED',
        }
    })





    // Spin the container
    const command = new RunTaskCommand({
        cluster: config.CLUSTER,
        taskDefinition: config.TASK,
        launchType: 'FARGATE',
        count: 1,
        networkConfiguration: {
            awsvpcConfiguration: {
                assignPublicIp: 'ENABLED',
                subnets: ['subnet-0e0284b05344835f9', 'subnet-0e9a4ad050dc58804', 'subnet-035e469c37475d816'],
                securityGroups: ['sg-07b29289882f07ca9']
            }
        },
        overrides: {
            containerOverrides: [
                {
                    name: 'builder-image',
                    environment: [
                        //first part
                        // { name: 'GIT_REPOSITORY__URL', value: gitURL },
                        // { name: 'PROJECT_ID', value: projectSlug }

                        //second part

                        { name: 'GIT_REPOSITORY__URL', value: project.gitURL },
                        { name: 'PROJECT_ID', value: projectId },
                        { name: 'DEPLOYEMENT_ID', value: deployment.id },
                    ]
                }
            ]
        }
    })

    await ecsClient.send(command);
    //first pro
    //return res.json({ status: 'queued', data: { projectSlug, url: `http://${projectSlug}.localhost:8000` } })

    //2nd pro
    return res.json({ status: 'queued', data: { deploymentId: deployment.id } })

})

//logs fetch
//todo:frontend have to do polling after let every 2 sec and then get the log
app.get('/logs/:id', async (req, res) => {
  const id = req.params.id;

  // Validate UUID format
  if (!/^[\w-]{36}$/.test(id)) {
    return res.status(400).json({ error: 'Invalid deployment ID format' });
  }

  try {
    const logs = await client.query({
      query: `
        SELECT event_id, deployment_id, log, timestamp 
        FROM log_events 
        WHERE deployment_id = {deployment_id:String}
        ORDER BY timestamp
      `,
      format: 'JSONEachRow',
      query_params: {
        deployment_id: id
      }
    });

    const rawLogs = await logs.json();
    return res.json({ logs: rawLogs });
  } catch (err) {
    console.error('Error fetching logs:', err);
    return res.status(500).json({ error: 'Failed to fetch logs' });
  }
});


//first part
// async function initRedisSubscribe() {
//     console.log('Subscribed to logs....')
//     subscriber.psubscribe('logs:*')
//     subscriber.on('pmessage', (pattern, channel, message) => {
//         io.to(channel).emit('message', message)
//     })
// }


// initRedisSubscribe()



//second part
async function initkafkaConsumer() {
    await consumer.connect();
    await consumer.subscribe({ topics: ['container-logs'], fromBeginning: true })

    await consumer.run({

        eachBatch: async function ({ batch, heartbeat, commitOffsetsIfNecessary, resolveOffset }) {

            const messages = batch.messages;
            console.log(`Recv. ${messages.length} messages..`)
            for (const message of messages) {
                if (!message.value) continue;
                const stringMessage = message.value.toString()
                const { PROJECT_ID, DEPLOYEMENT_ID, log } = JSON.parse(stringMessage)
                console.log({ log, DEPLOYEMENT_ID })
                try {
                    const { query_id } = await client.insert({
                        table: 'log_events',
                        values: [{ event_id: uuidv4(), deployment_id: DEPLOYEMENT_ID, log }],
                        format: 'JSONEachRow'
                    })
                    console.log(query_id)
                    resolveOffset(message.offset)
                    await commitOffsetsIfNecessary(message.offset)
                    await heartbeat()
                } catch (err) {
                    console.log(err)
                }

            }
        }
    })
}

initkafkaConsumer()

app.listen(PORT, () => console.log(`API Server Running..${PORT}`))