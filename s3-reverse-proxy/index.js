const express = require('express')
const httpProxy = require('http-proxy')
const fs = require('fs');
const { Client } = require('pg')
require('dotenv').config(); 

const app = express()
const PORT = 8000

const BASE_PATH = 'https://vercel-ayush.s3.ap-south-1.amazonaws.com/__outputs'



const proxy = httpProxy.createProxy()

// Setup PostgreSQL client with SSL CA
const connectionString = process.env.DATABASE_URL.replace('?sslmode=require', '?sslmode=no-verify');
const db = new Client({
    connectionString: connectionString
})
db.connect()

// const { Pool } = require('pg');

// const db = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: {
//     rejectUnauthorized: false // required by Aiven
//   }
// });

app.use(async (req, res) => {
    const hostname = req.hostname;
    const subdomain = hostname.split('.')[0];

    try {
        // 1. Find project by subdomain
        const projectResult = await db.query('SELECT id FROM "Project" WHERE "subdomain" = $1', [subdomain]);
        if (projectResult.rows.length === 0) {
            return res.status(404).send('Project not found');
        }
        const projectId = projectResult.rows[0].id;

        // 2. Find latest READY deployment for this project
        const deployResult = await db.query('SELECT id FROM "Deployement" WHERE "project_id" = $1 AND status = $2 ORDER BY "createdAt" DESC LIMIT 1', [projectId, 'READY']);
        if (deployResult.rows.length === 0) {
            return res.status(404).send('No deployment found');
        }
        const deploymentId = deployResult.rows[0].id;

        const resolvesTo = `${BASE_PATH}/${deploymentId}`;
        return proxy.web(req, res, { target: resolvesTo, changeOrigin: true });
    } catch (err) {
        console.error('Proxy error:', err);
        return res.status(500).send('Internal server error');
    }
})

proxy.on('proxyReq', (proxyReq, req, res) => {
    const url = req.url;
    if (url === '/')
        proxyReq.path += 'index.html'

})

app.listen(PORT, () => console.log(`Reverse Proxy Running..${PORT}`))