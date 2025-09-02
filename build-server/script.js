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
        accessKeyId: 'AKIARX2KG4C3QVDGKRR3',
        secretAccessKey: '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'
    }
})

const PROJECT_ID = process.env.PROJECT_ID
//second part

const DEPLOYEMENT_ID = process.env.DEPLOYEMENT_ID

const kafka = new Kafka({
    clientId: `docker-build-server-${DEPLOYEMENT_ID}`,
    brokers: ['kafka-92fa8e0-kumarbittu91422-0502.k.aivencloud.com:15301'],
    ssl: {
        ca: [fs.readFileSync(path.join(__dirname, 'kafka.pem'), 'utf-8')]
    },
    sasl: {
        username: 'avnadmin',
        password: 'AVNS_gkWXmB63WY6qtAPfDod',
        mechanism: 'plain'
    }

})

const producer = kafka.producer()

// Function to publish status updates via Kafka
async function publishStatusUpdate(status) {
    try {
        await producer.send({ 
            topic: `deployment-status`, 
            messages: [{ 
                key: 'status', 
                value: JSON.stringify({ 
                    PROJECT_ID, 
                    DEPLOYEMENT_ID, 
                    status,
                    timestamp: new Date().toISOString()
                }) 
            }] 
        });
        console.log(`Status update published: ${status}`);
    } catch (err) {
        console.error('Failed to publish status update:', err);
    }
}

//in first part the function is not async
async function publishLog(log) {
    if (!DEPLOYEMENT_ID) {
        console.error('DEPLOYEMENT_ID is missing! Not sending log. Log:', log);
        return;
    }
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
    
    // Update status to IN_PROGRESS
    await publishStatusUpdate('IN_PROGRESS');
    
    const outDirPath = path.join(__dirname, 'output')

    // Pre-build: Run npm audit and log vulnerabilities
    const auditProcess = exec(`cd ${outDirPath} && npm audit --json`)
    let auditData = '';
    auditProcess.stdout.on('data', function(data) {
        auditData += data.toString();
    });
    auditProcess.on('close', async function() {
        try {
            const auditResult = JSON.parse(auditData);
            if (auditResult.metadata && auditResult.metadata.vulnerabilities) {
                const { info, low, moderate, high, critical } = auditResult.metadata.vulnerabilities;
                const total = info + low + moderate + high + critical;
                if (total > 0) {
                    const warningMsg = `npm audit found vulnerabilities: info=${info}, low=${low}, moderate=${moderate}, high=${high}, critical=${critical}`;
                    console.warn(warningMsg);
                    await publishLog(warningMsg);
                } else {
                    await publishLog('npm audit found no vulnerabilities.');
                }
            }
        } catch (e) {
            await publishLog('npm audit failed or returned invalid JSON.');
        }
        // Continue with the build process
        startBuild();
    });

    function startBuild() {
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

        p.on('close', async function (code) {
            if (code === 0) {
                console.log('Build Complete')
                await publishLog(`Build Complete`)
                const distFolderPath = path.join(__dirname, 'output', 'dist')
                const distFolderContents = fs.readdirSync(distFolderPath, { recursive: true })

                await publishLog(`Starting to upload`)
                try {
                    for (const file of distFolderContents) {
                        const filePath = path.join(distFolderPath, file)
                        //tpo check that given filepath is folder or file  
                        if (fs.lstatSync(filePath).isDirectory()) continue;

                        console.log('uploading', filePath)
                        await publishLog(`uploading ${file}`)
                        
                        //command to put it into the s3
                        const command = new PutObjectCommand({
                            //create a s3 bucket and allow all permissions 
                            Bucket: 'vercel-ayush',
                            //this is the path where it will be stored in s3
                            Key: `__outputs/${DEPLOYEMENT_ID}/${file}`,
                            //actual content 
                            Body: fs.createReadStream(filePath),
                            //as our application is dynamic (as we dont know user is uploading in which language)so we have dynamic contenttypes so to handle this we will use mime-types module
                            ContentType: mime.lookup(filePath)  
                        })
                        
                        //now object will start uploading in the S3bucket
                        await s3Client.send(command)
                        await publishLog(`uploaded ${file}`)
                        console.log('uploaded', filePath)
                    }
                    await publishLog(`Done`)
                    console.log('Done...')
                    
                    // Update status to READY
                    await publishStatusUpdate('READY');
                    
                    process.exit(0)
                } catch (uploadError) {
                    console.error('Upload failed:', uploadError);
                    await publishLog(`Upload failed: ${uploadError.message}`);
                    
                    // Update status to FAILED
                    await publishStatusUpdate('FAILED');
                    
                    process.exit(1)
                }
            } else {
                console.error('Build failed with code:', code);
                await publishLog(`Build failed with exit code: ${code}`);
                
                // Update status to FAILED
                await publishStatusUpdate('FAILED');
                
                process.exit(1)
            }
        })
    }
    // Do not call startBuild() here; it will be called after audit completes
}

init()