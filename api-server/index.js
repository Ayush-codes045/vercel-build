require('dotenv').config()
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
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');


const app = express()
const PORT = 9000
app.use(cors());
const prisma = new PrismaClient({})

//first part
//const subscriber = new Redis('redis://default:AVNS_x4mJahn3ffn-xGtXAOB@valkey-6875c2f-bittukumar8083a-3189.j.aivencloud.com:10152')

const io = new Server({ cors: '*' })

//clickhouse client
const client = createClient({
    host: 'https://clickhouse-118a182a-kumarbittu91422-0502.c.aivencloud.com:15289',
    database: 'default',
    username: 'avnadmin',
    password: 'AVNS_4qv4hg7ANAClZpGLjGp'
})

//kafka 

const kafka = new Kafka({
    clientId: `api-server`,
    brokers: ['kafka-92fa8e0-kumarbittu91422-0502.k.aivencloud.com:15301'],
    ssl: {
        ca: [fs.readFileSync(path.join(__dirname, 'kafka.pem'), 'utf-8')],
        rejectUnauthorized: false
    },
    sasl: {
        username: 'avnadmin',
        password: 'AVNS_gkWXmB63WY6qtAPfDod',
        mechanism: 'plain'
    },
    connectionTimeout: 30000, // Increase timeout
    retry: {
        initialRetryTime: 300,
        retries: 8
    }
})
const consumer = kafka.consumer({ groupId: 'api-server-logs-consumer' })

//ye woh jb new connection aata h tho bolo kis channel pr subscribe krna h uspr krwas dega
// io.on('connection', socket => {
//     socket.on('subscribe', channel => {
//         socket.join(channel)
//         //message event pr subscribe kr rhe h
//         socket.emit('message', `Joined ${channel}`)
//     })
// })

// io.listen(9002, () => console.log('Socket Server 9002'))

const ecsClient = new ECSClient({
    region: 'ap-south-1',
    credentials: {
        accessKeyId: 'AKIARX2KG4C3QVDGKRR3',
        secretAccessKey: '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'
    }
})

const config = {
    CLUSTER: 'arn:aws:ecs:ap-south-1:119877853367:cluster/kalluisop',
    TASK: 'arn:aws:ecs:ap-south-1:119877853367:task-definition/builder-task'
}

app.use(express.json())

//todo: validate the user authenticate from the user table do if you want to add authentication

//second part
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// User registration endpoint
app.post('/register', async (req, res) => {
    const { firstname, lastname, email, password } = req.body;
    if (!firstname || !lastname || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        return res.status(409).json({ error: 'Email already registered' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
        data: { firstname, lastname, email, password: hashedPassword }
    });
    return res.json({ status: 'success', user: { id: user.id, email: user.email } });
});

// User login endpoint
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ status: 'success', token });
});

// JWT authentication middleware
function authenticateJWT(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Invalid token' });
        req.user = decoded;
        next();
    });
}

// Protect /project and /deploy endpoints
app.post('/project', authenticateJWT, async (req, res) => {
    const schema = z.object({
        name: z.string(),
        gitURL: z.string()
    })
    const safeParseResult = schema.safeParse(req.body)
    if (safeParseResult.error) return res.status(400).json({ error: safeParseResult.error })
    const { name, gitURL } = safeParseResult.data
    const gitUrlRegex = /^(https:\/\/|git@)([\w\.\@\:\/\-~]+)(\.git)(\/)?$/;
    if (!gitUrlRegex.test(gitURL)) {
        return res.status(400).json({ error: 'Invalid git repository URL. Please provide a valid HTTPS or SSH git URL ending with .git' });
    }
    // Associate project with authenticated user
    const project = await prisma.project.create({
        data: {
            name,
            gitURL,
            subDomain: generateSlug(),
            user: { connect: { id: req.user.userId } }
        }
    })
    return res.json({ status: 'success', data: { project } })
});

app.post('/deploy', authenticateJWT, async (req, res) => {
    const { projectId } = req.body
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) return res.status(404).json({ error: 'Project not found' })
    // Only allow deploy if project belongs to user
    if (project.userId !== req.user.userId) {
        return res.status(403).json({ error: 'You do not have permission to deploy this project' });
    }
    // Check for running or queued deployments
    const existingDeployment = await prisma.deployement.findFirst({
        where: {
            projectId: projectId,
            status: { in: ['QUEUED', 'IN_PROGRESS'] }
        }
    });
    if (existingDeployment) {
        return res.status(409).json({ error: 'A deployment is already in progress or queued for this project.' });
    }
    const deployment = await prisma.deployement.create({
        data: {
            project: { connect: { id: projectId } },
            status: 'QUEUED'
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
                subnets: ['subnet-0cb786e5771d2fc0e', 'subnet-03aeac688e171812c', 'subnet-0e578e15b552a314b'],
                securityGroups: ['sg-041f70b9b35b38947']
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
app.get('/logs/:id', authenticateJWT, async (req, res) => {
  const id = req.params.id;
  console.log('Fetching logs for deployment:', id);

  // Validate UUID format
  if (!/^[\w-]{36}$/.test(id)) {
    console.log('Invalid deployment ID format:', id);
    return res.status(400).json({ error: 'Invalid deployment ID format' });
  }

  try {
    // First verify the deployment belongs to the user
    const deployment = await prisma.deployement.findUnique({ 
      where: { id },
      include: { project: true }
    });
    
    if (!deployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }
    
    if (deployment.project.userId !== req.user.userId) {
      return res.status(403).json({ error: 'You do not have access to this deployment' });
    }

    console.log('Querying ClickHouse for deployment:', id);
    
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
    console.log(`Found ${rawLogs.length} logs for deployment ${id}`);
    
    // Log first few logs for debugging
    if (rawLogs.length > 0) {
      console.log('Sample logs:', rawLogs.slice(0, 3));
    }
    
    return res.json({ logs: rawLogs });
  } catch (err) {
    console.error('Error fetching logs:', err);
    return res.status(500).json({ error: 'Failed to fetch logs', details: err.message });
  }
});

// Get all projects for the authenticated user
app.get('/projects', authenticateJWT, async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get project details and its deployments
app.get('/projects/:id', authenticateJWT, async (req, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id, userId: req.user.userId },
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const deployments = await prisma.deployement.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ project, deployments });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project details' });
  }
});

// Get deployment status and subdomain
app.get('/deployments/:id', authenticateJWT, async (req, res) => {
  try {
    const deployment = await prisma.deployement.findUnique({ where: { id: req.params.id } });
    if (!deployment) return res.status(404).json({ error: 'Deployment not found' });
    const project = await prisma.project.findUnique({ where: { id: deployment.projectId, userId: req.user.userId } });
    if (!project) return res.status(403).json({ error: 'You do not have access to this deployment' });
    res.json({ status: deployment.status, subDomain: project.subDomain });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch deployment details' });
  }
});

// Update deployment status (called by build server)
app.put('/deployments/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Validate status
    const validStatuses = ['QUEUED', 'IN_PROGRESS', 'READY', 'FAILED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const deployment = await prisma.deployement.update({
      where: { id },
      data: { status }
    });
    
    res.json({ success: true, deployment });
  } catch (err) {
    console.error('Error updating deployment status:', err);
    res.status(500).json({ error: 'Failed to update deployment status' });
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
    
    // Create topics if they don't exist
    const admin = kafka.admin();
    await admin.connect();
    
    try {
        await admin.createTopics({
            topics: [
                { topic: 'container-logs', numPartitions: 3, replicationFactor: 1 },
                { topic: 'deployment-status', numPartitions: 3, replicationFactor: 1 }
            ]
        });
        console.log('Kafka topics created/verified');
    } catch (err) {
        // Topics might already exist, that's okay
        console.log('Topics might already exist:', err.message);
    }
    
    await admin.disconnect();
    
    await consumer.subscribe({ topics: ['container-logs', 'deployment-status'], fromBeginning: true })

    await consumer.run({

        eachBatch: async function ({ batch, heartbeat, commitOffsetsIfNecessary, resolveOffset }) {

            const messages = batch.messages;
            console.log(`Recv. ${messages.length} messages..`)
            for (const message of messages) {
                if (!message.value) continue;
                const stringMessage = message.value.toString()
                // Use batch.topic instead of message.topic
                console.log('Kafka message received:', { topic: batch.topic, value: stringMessage });
                
                try {
                    if (batch.topic === 'container-logs') {
                        const { PROJECT_ID, DEPLOYEMENT_ID, log } = JSON.parse(stringMessage)
                        if (!DEPLOYEMENT_ID) {
                            console.error('DEPLOYEMENT_ID is missing in log message:', stringMessage);
                            continue;
                        }
                        console.log('Inserting log to ClickHouse:', { DEPLOYEMENT_ID, log });
                        try {
                            const { query_id } = await client.insert({
                                table: 'log_events',
                                values: [{ event_id: uuidv4(), deployment_id: DEPLOYEMENT_ID, log }],
                                format: 'JSONEachRow'
                            })
                            console.log('Insert success:', query_id);
                        } catch (err) {
                            console.error('ClickHouse insert error:', err);
                        }
                    } else if (batch.topic === 'deployment-status') {
                        const { DEPLOYEMENT_ID, status } = JSON.parse(stringMessage)
                        console.log(`Updating deployment ${DEPLOYEMENT_ID} status to: ${status}`)
                        
                        // Update deployment status in database
                        await prisma.deployement.update({
                            where: { id: DEPLOYEMENT_ID },
                            data: { status }
                        });
                        console.log(`Deployment ${DEPLOYEMENT_ID} status updated to ${status}`);
                    }
                    
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