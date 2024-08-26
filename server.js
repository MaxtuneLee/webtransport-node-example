import { Http3Server } from '@fails-components/webtransport'
import { readFile } from 'node:fs/promises'
import Fastify from 'fastify'
import path from 'node:path'

const key = await readFile('cert/localhost.key')
const cert = await readFile('cert/localhost.crt')

const fastify = Fastify({
    logger: true,
    http2: true,
    https: {
        key,
        cert
    }
})

fastify.register(import('@fastify/static'), {
    root: path.resolve('public'),
    prefix: '/public/', // optional: default '/'
})

fastify.get('/', async (request, reply) => {
    return reply.sendFile('client.html')
})

const port = 3000

fastify.listen({ port }, (err, address) => {
    if (err) throw err
    console.log(`Server listening on ${address}`)
})

const h3Server = new Http3Server({
    port: 4433,
    host: "localhost",
    secret: "test",
    cert,
    privKey: key,
});

h3Server.startServer();

(async () => {
    try {
        const stream = await h3Server.sessionStream("/");
        const sessionReader = stream.getReader();

        while (true) {
            const result = await sessionReader.read();
            if (result.done) {
                console.log("Server is closed");
                break;
            }
            const session = result.value;

            session.closed
                .then(() => {
                    console.log("Server session closed");
                })
                .catch((err) => {
                    console.error("Server session errored", err);
                });

            console.log("new server session");
            await session.ready;
            console.log("Server session ready");
            // print data received from client
            const reader = session.datagrams.readable.getReader();
            const writer = session.datagrams.writable.getWriter();
            while (true) {
                const { value, done } = await reader.read();
                if (done) {
                    break;
                }
                console.log("Server received", new TextDecoder().decode(value));
                // echo back to client
                await writer.write(value);
                console.log("Server sent", new TextDecoder().decode(value));
            }
        }
    } catch (ex) {
        console.error("Server error", ex);
    }
})();