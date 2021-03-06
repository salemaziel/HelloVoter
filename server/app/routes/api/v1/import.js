import { Router } from 'express';
import _ from 'lodash';

import { valid, _400, _403, _404 } from '../../../lib/utils';

module.exports = Router({mergeParams: true})
/**
 * @swagger
 *
 * /import/required-fields:
 *   get:
 *     description: Get what import fields are required.
 *     tags:
 *       - import
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               "$ref": "#/components/schemas/data"
 */
.get('/import/required-fields', (req, res) => {
  if (req.user.admin !== true) return _403(res, "Permission denied.");
  if (req.config.enable_geocode) return res.json({count: 3, fields: [1,3,5]}); // things required to call a geocoder
  else return res.json({count: 3, fields: [1,6,7]}); // require street, lat, lng
})
/**
 * @swagger
 *
 * /import:
 *   post:
 *     description: Start a new import process
 *     tags:
 *       - import
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - "$ref": "#/components/schemas/filename"
 *               - "$ref": "#/components/schemas/attributes"
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               "$ref": "#/components/schemas/importId"
 */
.post('/import', async (req, res) => {
  if (req.user.admin !== true) return _403(res, "Permission denied.");
  if (!valid(req.body.filename)) return _400(res, "Invalid value to parameter 'filename'.");
  if (typeof req.body.attributes !== 'object') return _400(res, "Invalid value to parameter 'attributes'.");

  let ref = await req.db.query('match (a:ImportFile {filename:{filename}}) return count(a)', req.body);
  if (ref[0] !== 0) return _403(res, "Import File already exists.");

  // TODO: verify all attributes exist

  // attributes property stores which order they come in as
  ref = await req.db.query(`match (v:Volunteer {id:{id}})
    create (if:ImportFile {id: randomUUID(), filename:{filename}, created: timestamp(), attributes: {attributes}})
    create (if)-[:IMPORTED_BY]->(v)
      with if
    unwind {attributes} as attr
    match (at:Attribute {id:attr}) merge (if)-[:ATTRIBUTES]->(at)
      with distinct(if) as if
    return if.id`, _.merge({}, req.body, req.user));

  return res.json({importId: ref[0]});
})
/**
 * @swagger
 *
 * /import/{id}:
 *   post:
 *     description: Add data to an existing import process.
 *     tags:
 *       - import
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             "$ref": "#/components/schemas/data"
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               "$ref": "#/components/schemas/empty"
 *   get:
 *     description: Get stats of an import
 *     tags:
 *       - import
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               "$ref": "#/components/schemas/object"
 *   put:
 *     description: Signal you are done sending data to an import. Or more colloquially, "put" and "end" to an import
 *     tags:
 *       - import
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               "$ref": "#/components/schemas/empty"
 *   delete:
 *     description: Delete an import
 *     tags:
 *       - import
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               "$ref": "#/components/schemas/empty"
 */
.get('/import/:id', async (req, res) => {
  if (req.user.admin !== true) return _403(res, "Permission denied.");
  let imf = await req.db.query('match (if:ImportFile {id:{id}}) return if', req.params);
  if (imf.length === 0) return _404(res, "Import not found.");
  return res.json(imf[0]);
})
.post('/import/:id', async (req, res) => {
  if (req.user.admin !== true) return _403(res, "Permission denied.");
  if (typeof req.body.data !== 'object') return _400(res, "Invalid data.")
  if (req.body.data.length === 0) return _400(res, "Invalid data.")
  if (typeof req.body.data[0] !== 'object') return _400(res, "Invalid data.")
  if (req.body.data[0].length === 0) return _400(res, "Invalid data.")

  let imf = await req.db.query('match (if:ImportFile {id:{id}}) return if', req.params);
  if (imf.length === 0) return _404(res, "Import not found.");

  // TODO: verify data.length matches attriutes.length+8
  // TODO: verify each attribute exists in this import

  // convert attriutes to part of a cypher query
  let attrq = "";
  let ref = await req.db.query('match (if:ImportFile {id:{id}}) return if.attributes', req.params);
  for (let i = 0; i < ref[0].length; i++) {
    attrq += ',`'+ref[0][i]+'`:r['+(i+8)+']';
  }
  await req.db.query(`match (if:ImportFile {id:{id}})
    with if
  unwind {data} as r
  create (ir:ImportRecord {pid:r[0], street:r[1], unit:r[2], city:r[3], state:r[4], zip:r[5], lng:r[6], lat:r[7]`+attrq+`})
  merge (ir)-[:FILE]->(if)`,
    _.merge({}, req.body, req.params));

  return res.json({});
})
.put('/import/:id', async (req, res) => {
  if (req.user.admin !== true) return _403(res, "Permission denied.");

  let ref = await req.db.query('match (if:ImportFile {id:{id}}) return if', req.params);
  if (ref.length === 0) return _404(res, "Import not found.");
  if (ref[0].submitted) return _403(res, "Import File already submitted for processing.");

  let imf = await req.db.query('match (if:ImportFile {id:{id}}) set if.submitted = timestamp() return if', req.params);
  let job = await req.qq.queueTask('doProcessImport', 'ImportFile {filename:{filename}}', {filename: imf[0].filename});

  return res.json(job);
})
.delete('/import/:id', async (req, res) => {
  if (req.user.admin !== true) return _403(res, "Permission denied.");
  // prevent deleting an in-flight import
  let qt = await req.db.query('match (if:ImportFile {id:{id}})-[:PROCESSED_BY]->(qt:QueueTask) return qt', req.params);
  if (!qt[0].completed) return _403(res, "Import is not finished yet.");

  // TODO: delete imported records as well
  await req.db.query('match (if:ImportFile {id:{id}}) set if:DeletedImportFile remove if:ImportFile', req.params);
  return res.json({deleted: true})
})
/**
 * @swagger
 *
 * /imports:
 *   get:
 *     description: List all imports
 *     tags:
 *       - import
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               "$ref": "#/components/schemas/data"
 */
.get('/imports', async (req, res) => {
  if (req.user.admin !== true) return _403(res, "Permission denied.");
  let im = await req.db.query('match (a:ImportFile) return a order by a.created desc', {});
  return res.json({
    count: im.length,
    import: im,
  });
})
