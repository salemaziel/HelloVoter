import { Docker, Options } from 'docker-cli-js';
import jwt from 'jsonwebtoken';
import { expect } from 'chai';
import keypair from 'keypair';
import fs from 'fs';

import { appInit, base_uri, genName, testToken, writeObj } from './lib/utils';
import { runDatabase, genkeys } from '../scripts/lib/utils';
import { min_neo4j_version } from '../app/lib/utils';
import { hv_config } from '../app/lib/hv_config';
import { doStartupTasks } from '../app/lib/startup';
import neo4j from '../app/lib/neo4j';
import queue from '../app/lib/queue';

var api;
var db;
var qq;
var c = {};
var turfs = {};
var forms = {};
var public_key, private_key;
var docker = new Docker(new Options());

describe('Database Init', function () {

  before(async () => {
    await runDatabase({docker, sandbox: true, config: {
      pagecache_size: 0,
      heap_size_init: 0,
      heap_size_max: 0,
    }});

    genkeys({fs, keypair});

    db = new neo4j(hv_config);
    qq = new queue(db);
    api = await appInit(db);
  });

  after(async () => {
    writeObj('volunteers', c);
    writeObj('turfs', turfs);
    writeObj('forms', forms);
    db.close();
  });

  it('correct database version', async () => {
    let arr = (await db.version()).split('.');
    let ver = Number.parseFloat(arr[0]+'.'+arr[1]);

    if (ver < min_neo4j_version) {
      console.warn("Neo4j version "+min_neo4j_version+" or higher is required.");
      process.exit(1);
    }
  });

  it('database has no nodes', async () => {
    await db.query("match (a) detach delete a");
    let ref = await db.query("match (a) return count(a)");
    expect(ref[0]).to.equal(0);
  });

  it('database startup tasks', async () => {
    await doStartupTasks(db, qq, {});
  });

  it('rsa keys match', async () => {
    public_key = fs.readFileSync('./test/rsa.pub', "utf8");
    private_key = fs.readFileSync('./test/rsa.key', "utf8");

    expect(jwt.verify(testToken(private_key), public_key)).to.have.property('id');
  });

  it('OPTIONS returns ok', async () => {
    let r = await api.options(base_uri+'/poke')
    expect(r.statusCode).to.equal(204);
  });

  it('hello 200 admin awaiting assignment', async () => {
    let t = testToken(private_key, true);
    c.admin = jwt.verify(t, public_key);
    c.admin.jwt = t;

    let r = await api.post(base_uri+'/hello')
      .set('Authorization', 'Bearer '+c.admin.jwt)
      .send({
        longitude: -118.3281370,
        latitude: 33.9208231,
      });
    expect(r.statusCode).to.equal(200);
    expect(r.body.msg).to.equal("Thanks for your request to join us! You are currently awaiting an assignment.");
    expect(r.body.ready).to.equal(false);

    // make admin an admin
    await db.query('match (a:Volunteer {id:{id}}) set a.admin=true', c.admin);

    r = await api.post(base_uri+'/hello')
      .set('Authorization', 'Bearer '+c.admin.jwt)
      .send({
        longitude: -118.3281370,
        latitude: 33.9208231,
      });
    expect(r.statusCode).to.equal(200);
    expect(r.body.admin).to.equal(true);
  });

  it('hello 200 volunteers awaiting assignment', async () => {
    let t = testToken(private_key);
    c.bob = jwt.verify(t, public_key);
    c.bob.jwt = t;

    t = testToken(private_key);
    c.sally = jwt.verify(t, public_key);
    c.sally.jwt = t;

    t = testToken(private_key);
    c.rich = jwt.verify(t, public_key);
    c.rich.jwt = t;

    t = testToken(private_key);
    c.jane = jwt.verify(t, public_key);
    c.jane.jwt = t;

    t = testToken(private_key);
    c.mike = jwt.verify(t, public_key);
    c.mike.jwt = t;

    t = testToken(private_key);
    c.han = jwt.verify(t, public_key);
    c.han.jwt = t;

    let r = await api.post(base_uri+'/hello')
      .set('Authorization', 'Bearer '+c.bob.jwt)
      .send({
        longitude: -118.3281370,
        latitude: 33.9208231,
      });
    expect(r.statusCode).to.equal(200);
    expect(r.body.msg).to.equal("Thanks for your request to join us! You are currently awaiting an assignment.");
    expect(r.body.ready).to.equal(false);
    expect(r.body).to.not.have.property("admin");

    r = await api.post(base_uri+'/hello')
      .set('Authorization', 'Bearer '+c.sally.jwt)
      .send({
        longitude: -118.3281370,
        latitude: 33.9208231,
      });
    expect(r.statusCode).to.equal(200);
    expect(r.body.msg).to.equal("Thanks for your request to join us! You are currently awaiting an assignment.");
    expect(r.body.ready).to.equal(false);
    expect(r.body).to.not.have.property("admin");

    r = await api.post(base_uri+'/hello')
      .set('Authorization', 'Bearer '+c.rich.jwt)
      .send({
        longitude: -118.3281370,
        latitude: 33.9208231,
      });
    expect(r.statusCode).to.equal(200);
    expect(r.body.msg).to.equal("Thanks for your request to join us! You are currently awaiting an assignment.");
    expect(r.body.ready).to.equal(false);
    expect(r.body).to.not.have.property("admin");

    r = await api.post(base_uri+'/hello')
      .set('Authorization', 'Bearer '+c.jane.jwt)
      .send({
        longitude: -118.3281370,
        latitude: 33.9208231,
      });
    expect(r.statusCode).to.equal(200);
    expect(r.body.msg).to.equal("Thanks for your request to join us! You are currently awaiting an assignment.");
    expect(r.body.ready).to.equal(false);
    expect(r.body).to.not.have.property("admin");

    r = await api.post(base_uri+'/hello')
      .set('Authorization', 'Bearer '+c.mike.jwt)
      .send({
        longitude: -118.3281370,
        latitude: 33.9208231,
      });
    expect(r.statusCode).to.equal(200);
    expect(r.body.msg).to.equal("Thanks for your request to join us! You are currently awaiting an assignment.");
    expect(r.body.ready).to.equal(false);
    expect(r.body).to.not.have.property("admin");

    r = await api.post(base_uri+'/hello')
      .set('Authorization', 'Bearer '+c.han.jwt)
      .send({
        longitude: -118.3281370,
        latitude: 33.9208231,
      });
    expect(r.statusCode).to.equal(200);
    expect(r.body.msg).to.equal("Thanks for your request to join us! You are currently awaiting an assignment.");
    expect(r.body.ready).to.equal(false);
    expect(r.body).to.not.have.property("admin");
  });

  it('generate test objects - turfs', async () => {
    turfs.A = { name: genName("Turf") };

    let r = await api.post(base_uri+'/turf')
      .set('Authorization', 'Bearer '+c.admin.jwt)
      .send({
        name: turfs.A.name,
        geometry: JSON.parse(fs.readFileSync('./geojson/CA.geojson')),
      });
    expect(r.statusCode).to.equal(200);
    turfs.A.id = r.body.turfId;

    turfs.B = { name: genName("Turf") };

    r = await api.post(base_uri+'/turf')
      .set('Authorization', 'Bearer '+c.admin.jwt)
      .send({
        name: turfs.B.name,
        geometry: JSON.parse(fs.readFileSync('./geojson/CA-sldl-62.geojson')).geometry,
      });
    expect(r.statusCode).to.equal(200);
    turfs.B.id = r.body.turfId;

    turfs.C = { name: genName("Turf") };

    r = await api.post(base_uri+'/turf')
      .set('Authorization', 'Bearer '+c.admin.jwt)
      .send({
        name: turfs.C.name,
        geometry: JSON.parse(fs.readFileSync('./geojson/UT.geojson')),
      });
    expect(r.statusCode).to.equal(200);
    turfs.C.id = r.body.turfId;
  });

  it('generate test objects - forms', async () => {
    forms.A = { name: genName("Form") };

    let r = await api.post(base_uri+'/form')
      .set('Authorization', 'Bearer '+c.admin.jwt)
      .send({
        name: forms.A.name,
        attributes: ["013a31db-fe24-4fad-ab6a-dd9d831e72f9"],
      });
    expect(r.statusCode).to.equal(200);
    forms.A.id = r.body.formId;

    forms.B = { name: genName("Form") };

    r = await api.post(base_uri+'/form')
      .set('Authorization', 'Bearer '+c.admin.jwt)
      .send({
        name: forms.B.name,
        attributes: ["013a31db-fe24-4fad-ab6a-dd9d831e72f9"],
      });
    expect(r.statusCode).to.equal(200);
    forms.B.id = r.body.formId;
  });

});
