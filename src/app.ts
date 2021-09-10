import express from 'express';
import { Request, Response, NextFunction } from "express";
import path from "path";
import mime from 'mime-types';
import fs from "fs";
import { parse as cueParser } from 'cue-parser';
import { formatRange, getRange, RANGE_TYPE } from './range';
import { Transform, TransformCallback, TransformOptions } from 'stream'
import { start } from 'repl';

// @todo...
class RegionPatch extends Transform {
  constructor(opts?: TransformOptions) {
    super({ ...opts })
  }

  _transform(chunk: Buffer, _: string, callback: TransformCallback) {
    console.log(chunk.length)
    this.push(chunk)
    callback()
  }
}


const app = express()
const port = process.env.PORT || 3000

//const data_name = path.join(__dirname, "../public/Burning Rangers (US).img");
//const toc_name = path.join(__dirname, "../public/Burning Rangers (US).cue");
//const data_name = path.join(__dirname, "../public/sfa2.img");
//const toc_name = path.join(__dirname, "../public/sfa2.cue");
//const data_name = path.join(__dirname, "../../Lunar Silver Star Story Complete (JP)/Lunar Silver Star Story Complete (JP).img");
//const toc_name = path.join(__dirname, "../../Lunar Silver Star Story Complete (JP)/Lunar Silver Star Story Complete (JP).cue");
//const data_name = path.join(__dirname, "../../Thunder Force 5 (JP)/Thunder Force 5 (JP).img");
//const toc_name = path.join(__dirname, "../../Thunder Force 5 (JP)/Thunder Force 5 (JP).cue");
const data_name = path.join(__dirname, "../public/Real Bout Garou Densetsu The Final Battle Geese Howard Must Go (JP).img");
const toc_name = path.join(__dirname, "../public/Real Bout Garou Densetsu The Final Battle Geese Howard Must Go (JP).cue");

app.use(function timeLog(req, res, next) {
  console.log(`Time: ${Date.now()} - ${req.url}`,);
  next();
});

app.get('/data', async (req: Request, res: Response) => {

  try {
    const sector_sz = 2352;
    const range = getRange(req.headers.range)
    console.log(req.headers.dbg, range)
    const config = { ...range, highWaterMark: sector_sz }
    const { size } = await fs.promises.stat(data_name)
    if (size === 0) {
      return res.status(404).send();
    }

    if (!config.end) {
      config.end = size
    }
    config.size = range.end - range.start

    res.header("Content-Type", 'application/octet-stream');
    const stream = fs.createReadStream(data_name, config);

    res.writeHead(206, {
      "Content-Length": size,
      "Accept-Ranges": RANGE_TYPE,
      "Content-Range": formatRange(range)
    });

    function closeReadStream() {
      stream.close();
      stream.push(null)
      stream.read(0)
      stream.destroy();
    }

    stream.pipe(res)
    res.on('close', () => {
      closeReadStream();
      console.log('close')
    })

    res.on('error', () => {
      closeReadStream();
      console.log('error')
    })

  } catch (e) {
    console.error(e)
    return res.status(500).send();
  }
})

function FADToMSF(val: number) {
  const temp = val / 4500
  return {
    pmin: Math.floor(val / 4500),
    psec: Math.floor(temp / 75),
    pframe: Math.floor(temp % 75)
  }
}

async function getToc() {
  // @todo ... not hardcoded...
  // number of seconds of pregap
  // see: https://problemkaputt.de/psx-spx.htm#cdromdiskimagescuebincdtcdrwin
  const pregap = 2;
  const cue = cueParser(toc_name)
  const tracks = cue.files[0].tracks;

  const { size } = await fs.promises.stat(data_name)

  const control_map = {
    AUDIO: 0x01,
    "MODE1/2352": 0x41,
    "MODE2/2352": 0x41,
  }
  // leadin/leadout
  const toc = [
    {
      control: 0x41,
      point: 0xa0,
      min: 0,
      sec: 2,
      frame: 0,
      zero: 0,
      pmin: 1,
      psec: 0,
      pframe: 0,
      tno: 0,
    },
    {
      control: 0x01,
      point: 0xa1,
      min: 0,
      sec: 2,
      frame: 0,
      zero: 0,
      pmin: tracks.length,
      psec: 0,
      pframe: 0,
      tno: 0,
    },
    {
      control: 0x01,
      point: 0xa2,
      min: 0,
      sec: 2,
      frame: 0,
      zero: 0,
      tno: 0,
      ...FADToMSF((size / 2352) + (pregap * 75))
    }
  ]

  const ret = tracks.map(track => {
    return {
      // @ts-ignore
      control: control_map[track.type],
      point: track.number,
      min: 0,
      sec: 2,
      frame: 0,
      zero: 0,
      pmin: track.indexes[0].time.min,
      psec: track.indexes[0].time.sec + pregap,
      pframe: track.indexes[0].time.frame,
      tno: 0,
    }
  })

  return [...toc, ...ret]
}

app.get('/toc', async (req: Request, res: Response) => {
  res.json(await getToc());
})

app.get('/toc_bin', async (req: Request, res: Response) => {
  const toc = await getToc()
  const bin = new Uint8Array(10 * toc.length);

  let i = 0;
  toc.forEach(t => {
    // uint8_t ctrladr;
    bin[i++] = t.control
    // uint8_t tno;
    bin[i++] = t.tno
    // uint8_t point;
    bin[i++] = t.point
    // uint8_t min;
    bin[i++] = t.min
    // uint8_t sec;
    bin[i++] = t.sec
    // uint8_t frame;
    bin[i++] = t.frame
    // uint8_t zero;
    bin[i++] = t.zero
    // uint8_t pmin;
    bin[i++] = t.pmin
    // uint8_t psec;
    bin[i++] = t.psec
    // uint8_t pframe;
    bin[i++] = t.pframe
  })

  res.header("Content-Type", "application/octet-stream");
  res.send(Buffer.from(bin));
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})