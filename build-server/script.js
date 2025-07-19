const { exec } = require('child_process')
const path = require('path')
const fs = require('fs')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const mime = require('mime-types')
//first project
//const Redis = require('ioredis')
//const publisher = new Redis('redis://default:AVNS_x4mJahn3ffn-xGtXAOB@valkey-6875c2f-bittukumar8083a-3189.j.aivencloud.com:10152')

//2 project
const { Kafka } = require('kafkajs')

//this we will get from IAM and then create user give admin permission and others then generate access key
const s3Client = new S3Client({
    region: 'ap-south-1',
    credentials: {
        accessKeyId: 'AKIAVANY3YXMLR5V7UGX',
        secretAccessKey: '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'
    }
})

const PROJECT_ID = process.env.PROJECT_ID
//second part

const DEPLOYEMENT_ID = process.env.DEPLOYEMENT_ID

const kafka = new Kafka({
    clientId: `docker-build-server-${DEPLOYEMENT_ID}`,
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

const producer = kafka.producer()


//in first part the function is not async
async function publishLog(log) {
    //1 st part

    //projecd id is channel ispr publish krna h
    // publisher.publish(`logs:${PROJECT_ID}`, JSON.stringify({ log }))

    //2nd part
    await producer.send({ topic: `container-logs`, messages: [{ key: 'log', value: JSON.stringify({ PROJECT_ID, DEPLOYEMENT_ID, log }) }] })
}

async function init() {

    //2nd part

    await producer.connect()
    //
    //note in second part jha jha hm publish log ka use kr rhe h wha wha await lgana hoga
    console.log('Executing script.js')
    await publishLog('Build Started...')
    const outDirPath = path.join(__dirname, 'output')

    //todo:npm run build can we inssert malware in this what are the prpcess to resolve that by reading package.json 
    const p = exec(`cd ${outDirPath} && npm install && npm run build`)

    p.stdout.on('data', async function (data) {
        console.log(data.toString())
        await publishLog(data.toString())
    })

    p.stdout.on('error', async function (data) {
        console.log('Error', data.toString())
        await publishLog(`error: ${data.toString()}`)
    })

    p.on('close', async function () {
        console.log('Build Complete')
        await publishLog(`Build Complete`)
        const distFolderPath = path.join(__dirname, 'output', 'dist')
        const distFolderContents = fs.readdirSync(distFolderPath, { recursive: true })

        await publishLog(`Starting to upload`)
        for (const file of distFolderContents) {
            const filePath = path.join(distFolderPath, file)
            //tpo check that given filepath is folder or file  
            if (fs.lstatSync(filePath).isDirectory()) continue;

            console.log('uploading', filePath)
            await publishLog(`uploading ${file}`)
            
            //command to put it into the s3
            const command = new PutObjectCommand({
                //create a s3 bucket and allow all permissions 
                Bucket: 'vercel-deploy-ayu',
                //this is the path where it will be stored in s3
                Key: `__outputs/${PROJECT_ID}/${file}`,
                //actual content 
                Body: fs.createReadStream(filePath),
                //as our application is dynamic (as we dont know user is uploading in which language)so we have dynamic contenttypes so to handle this we will use mime-types module
                ContentType: mime.lookup(filePath)  
            })
            
            //now object will start uploading in the bucket
            await s3Client.send(command)
            await publishLog(`uploaded ${file}`)
            console.log('uploaded', filePath)
        }
        await publishLog(`Done`)
        console.log('Done...')
        process.exit(0)
    })
}

init()