import { Http3Server } from '@fails-components/webtransport'
import { readFile } from 'node:fs/promises'
import Fastify from 'fastify'
import path from 'node:path'
import { allSend, bytesToDecimal, send } from './utls.js'

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
    port: 4443,
    host: "localhost",
    secret: "test",
    cert,
    privKey: key,
});

h3Server.startServer();

async function readDataFromDatagrams(transport) {
    const datagramReader = transport.datagrams.readable.getReader();
    while (true) {
        const { value, done } = await datagramReader.read();
        if (done) {
            console.log("Done reading datagrams!");
            break;
        }
        const data = new TextDecoder().decode(value);
        console.log("Server received", data);
        // echo back to client
        const writer = transport.datagrams.writable.getWriter();
        await writer.write(value);
        console.log("Server sent", data);
    }
}

let globalSendCache = [];

(async () => {
    try {
        const stream = await h3Server.sessionStream("/subscribe");
        const sessionReader = stream.getReader();
        console.log("Server session stream created");

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

            const unidirectional = await session.createUnidirectionalStream();
            console.log("Server created unidirectional stream");
            while (true) {
                // console.log("Server send cache length", globalSendCache.length);
                if (globalSendCache.length) {
                    const data = globalSendCache.shift();
                    try {
                        const writer = unidirectional.getWriter();
                        await send(writer, data);
                        console.log("Server sent: ", data.byteLength);
                    } catch (ex) {
                        console.error("Server error", ex);
                    }
                    console.log("Server sent: ", data.byteLength);
                }
            }
        }
    } catch (ex) {
        console.error("Server error", ex);
    }
})();

(async () => {
    try {
        const stream = await h3Server.sessionStream("/publish");
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

            // pipe unidirectional stream to bidirectional stream
            const unidirectional = await session.incomingUnidirectionalStreams.getReader();

            while (true) {
                const { value, done } = await unidirectional.read();
                if (done) {
                    await writer.close();
                    break;
                }
                const reader = value.getReader();
                let buf = new Uint8Array(0)
                let packSize = null
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        break;
                    }
                    // console.log("Server received", new TextDecoder().decode(value));
                    // echo back to client

                    if (packSize === null) {
                        try {
                            const frameSizeArray = value.slice(0, 4);
                            const frameSize = bytesToDecimal(frameSizeArray);
                            if (frameSize < 10000) {
                                // console.log("Server received", frameSize, value.byteLength);
                                packSize = frameSize + 4;
                            }
                        } catch (ex) {
                            console.error("Server error", ex);
                        }
                    }
                    if (buf.byteLength < packSize) {
                        const newBuf = new Uint8Array(buf.byteLength + value.byteLength);
                        newBuf.set(buf);
                        newBuf.set(value, buf.byteLength);
                        buf = newBuf;
                    } else if (buf.byteLength === packSize) {
                        // console.log("Server received", buf.byteLength);
                        globalSendCache.push(buf);
                        buf = new Uint8Array(0);
                        packSize = null;
                    }
                }
                reader.releaseLock();
            }

            // print data received from client
            // const reader = session.datagrams.readable.getReader();
            // const writer = session.datagrams.writable.getWriter();
            // while (true) {
            //     const { value, done } = await reader.read();
            //     if (done) {
            //         console.log("Done reading datagrams!");
            //         break;
            //     }
            //     console.log("Server received", new TextDecoder().decode(value));
            //     // echo back to client
            //     await writer.write(value);
            //     console.log("Server sent", new TextDecoder().decode(value));
            // }
            // // receive data from incomingBidirectionalStreams
            // const bds = session.incomingBidirectionalStreams.getReader();
            // while (true) {
            //     const { value, done } = await bds.read();
            //     if (done) {
            //         break;
            //     }
            //     const streamReader = value.readable.getReader();
            //     const streamWriter = value.writable.getWriter();
            //     while (true) {
            //         const { done, value } = await streamReader.read();
            //         if (done) {
            //             break;
            //         }
            //         console.log("Server received", new TextDecoder().decode(value));
            //         // echo back to client
            //         await streamWriter.write(value);
            //         console.log("Server sent", new TextDecoder().decode(value));
            //     }
            // }
            // receive data from incomingUnidirectionalStreams
            // const uniReader = session.incomingUnidirectionalStreams.getReader();
            // while (true) {
            //     const { value, done } = await uniReader.read();
            //     console.log("Server received", value);
            //     if (done) {
            //         break;
            //     }
            //     const reader = value.getReader();
            //     while (true) {
            //         const { done, value } = await reader.read();
            //         if (done) {
            //             break;
            //         }
            //         // value is a Uint8Array
            //         console.log("Server received", new TextDecoder().decode(value));
            //         // echo back to client
            //         // const unidirectional = await session.createUnidirectionalStream();
            //         // const unidirectionalWriter = unidirectional.writable.getWriter();
            //         // await unidirectionalWriter.write(value);
            //         // await unidirectionalWriter.close();
            //     }
            // }
        }
    } catch (ex) {
        console.error("Server error", ex);
    }
})();