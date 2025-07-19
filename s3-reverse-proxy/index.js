const express = require('express')
const httpProxy = require('http-proxy')

const app = express()
const PORT = 8000

const BASE_PATH = 'https://vercel-deploy-ayu.s3.ap-south-1.amazonaws.com/__outputs'

const proxy = httpProxy.createProxy()

app.use((req, res) => {
    //ye jha user request kiya wo h
    const hostname = req.hostname;
    //ye jho mera folder name h wo nikal liye h
    const subdomain = hostname.split('.')[0];

    // Custom Domain - DB Query

    //custom domain deployment id nikalna hoga 

    //first part
    //yha hamara resolve hoga
    // const resolvesTo = `${BASE_PATH}/${subdomain}`


    //only for testing
    //todo:we have to do database query acoording to the subdomain we will get project id then we will resolve it
    
    const id='a091bac9-8de5-49e1-a924-f031bdefedea'
    const resolvesTo = `${BASE_PATH}/${id}`


    return proxy.web(req, res, { target: resolvesTo, changeOrigin: true })

})

proxy.on('proxyReq', (proxyReq, req, res) => {
    const url = req.url;
    if (url === '/')
        proxyReq.path += 'index.html'

})

app.listen(PORT, () => console.log(`Reverse Proxy Running..${PORT}`))