import { Router } from "express"
import { URL } from "url"
import { lookup } from "node:dns"
import postgres from "postgres"
import file from "./file"

const router = Router()
const sql = postgres(process.env.URI)

// TODO need to fix issue
router.use((req, _res, next) => {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress
    const language = req.headers["accept-language"]
    const method = req.method
    const url = req.url

    console.log(method, url, ip, language)
    console.log(req.headers.accept)
    console.log(req.headers["user-agent"])
    next()
})

router.get("/", (_req, res) => res.send(file))
router.post("/", async (req, res) => {
    try {
        const { original_url } = req.body
        const url = new URL(original_url)

        lookup(url.hostname, async (invalid) => {
            if (invalid) return res.sendStatus(400)

            const exist = (await sql`SELECT short_code FROM urls WHERE original_url = ${original_url}`).shift()
            if (exist) return res.json({ shortUrl: exist.short_code, original_url })

            const short_code = new Date().getTime().toString(36)
            await sql`INSERT INTO urls ${sql({ original_url, short_code })}`

            res.json({ shortUrl: short_code, original_url })
        })
    } catch (error) {
        if (error instanceof Error && error.message === "Invalid URL") return res.sendStatus(400)
        res.status(500).json({ error: "An unknown error happen" })
        console.log(error)
    }
})

router.get("/:code", async (req, res) => {
    try {
        const { code } = req.params
        const result = await sql`SELECT original_url FROM urls WHERE short_code = ${code}`
        if (!result.length) return res.status(404).send("URL not found")
        res.redirect(result[0].original_url)
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "An unknown error happen" })
    }
})

router.use((_req, res) => res.status(404).json({ error: "Oh no... look like you entered wrong url" }))
export default () => router

/*
-- create table
CREATE TABLE urls (
  id UUID PRIMARY KEY default gen_random_uuid(),
  original_url TEXT NOT NULL,
  short_code VARCHAR(10) NOT NULL UNIQUE
);
*/
