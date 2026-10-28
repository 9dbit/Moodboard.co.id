import { z } from "zod";
import { pool } from "./db";
import { mcpTransaction, siteOrigin } from "./mcp-auth";
import { hashToken } from "./auth-crypto";
import { fetchRemoteImage } from "./image-recovery";
import { ingestOwnedImage, deleteOwnedAsset } from "./assets";
import { getReferenceVersion } from "./reference-service";

export const boardPatchSchema = z.object({
  title:z.string().trim().min(1).max(200).optional(),descriptionRaw:z.string().max(6000).optional(),
  studioName:z.string().max(160).optional(),designerName:z.string().max(160).optional(),
  paperSize:z.enum(["A4","A3","A2"]).optional(),orientation:z.enum(["horizontal","vertical"]).optional(),
  imageLayout:z.enum(["original","square","portrait_3_5","portrait_9_16","landscape_5_3","landscape_16_9"]).optional(),
  gridColumns:z.number().int().min(2).max(5).optional(),canvasBackground:z.string().regex(/^#[\da-fA-F]{6}$/).optional(),showCover:z.boolean().optional(),showFooter:z.boolean().optional(),
}).strict();
export const requestKey = z.string().min(8).max(120).regex(/^[a-zA-Z0-9_-]+$/);
const columnNames: Record<string,string>={title:"title",descriptionRaw:"description_raw",studioName:"studio_name",designerName:"designer_name",paperSize:"paper_size",orientation:"orientation",imageLayout:"image_layout",gridColumns:"grid_columns",canvasBackground:"canvas_background",showCover:"show_cover",showFooter:"show_footer"};
export class BoardError extends Error { constructor(public status:number,message:string){super(message);} }
function view(p:any){return {id:p.id,title:p.title,description:p.description_raw,paperSize:p.paper_size,orientation:p.orientation,imageLayout:p.image_layout,gridColumns:p.grid_columns,canvasBackground:p.canvas_background,updatedAt:new Date(p.updated_at).toISOString(),url:new URL(`/editor/${p.id}`,siteOrigin()).href};}
export async function listBoards(ownerId:string,offset=0,limit=20){
  const {rows}=await pool.query(`SELECT p.*, (SELECT count(*)::int FROM pins WHERE project_id=p.id) AS pin_count FROM projects p WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3`,[ownerId,limit,offset]);
  return {boards:rows.map(p=>({...view(p),pinCount:p.pin_count})),nextOffset:rows.length===limit?offset+limit:null};
}
export async function getBoard(ownerId:string,id:number,offset=0){
  const p=(await pool.query("SELECT * FROM projects WHERE id=$1 AND user_id=$2",[id,ownerId])).rows[0];
  if(!p)throw new BoardError(404,"Moodboard not found");
  const rows=(await pool.query("SELECT id,title,description_final,description_ai,description_custom_input,description_enabled,width,height,position,source_url FROM pins WHERE project_id=$1 ORDER BY position,id LIMIT 100 OFFSET $2",[id,offset])).rows;
  return {board:view(p),references:rows.map(x=>({id:x.id,title:x.title,caption:x.description_final||x.description_ai||x.description_custom_input||"",descriptionEnabled:x.description_enabled!==false,version:getReferenceVersion(x),width:x.width,height:x.height,position:x.position,sourceUrl:x.source_url})),nextOffset:rows.length===100?offset+100:null};
}
export async function createBoard(ownerId:string,key:string,input:unknown){
  const fields=boardPatchSchema.extend({title:z.string().trim().min(1).max(200)}).parse(input);
  return mcpTransaction(async c=>{
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))",[ownerId+":create:"+key]);
    const digest=hashToken(JSON.stringify(fields));
    const previous=(await c.query("SELECT * FROM moodboard_tool_requests WHERE owner_id=$1 AND operation='create' AND request_key=$2",[ownerId,key])).rows[0];
    if(previous){if(previous.input_hash!==digest)throw new BoardError(409,"This request key was used with different data");return previous.result;}
    const cols=Object.keys(fields).map(k=>columnNames[k]);
    const vals=Object.values(fields);
    const row=(await c.query(`INSERT INTO projects(user_id,${cols.join(",")}) VALUES($1,${vals.map((_,i)=>'$'+(i+2)).join(',')}) RETURNING *`,[ownerId,...vals])).rows[0];
    const out={board:view(row)};
    await c.query("INSERT INTO moodboard_tool_requests(owner_id,operation,request_key,input_hash,result) VALUES($1,'create',$2,$3,$4)",[ownerId,key,digest,out]);
    return out;
  });
}
export async function updateBoard(ownerId:string,id:number,expectedVersion:string,input:unknown){
  const fields=boardPatchSchema.parse(input), entries=Object.entries(fields);
  if(!entries.length)throw new BoardError(400,"Provide at least one change");
  const p=(await pool.query(`UPDATE projects SET ${entries.map(([k],i)=>columnNames[k]+'=$'+(i+4)).join(',')},updated_at=greatest(clock_timestamp(),updated_at+interval '1 millisecond')
    WHERE id=$1 AND user_id=$2 AND date_trunc('milliseconds',updated_at)=date_trunc('milliseconds',$3::timestamp) RETURNING *`,[id,ownerId,expectedVersion,...entries.map(x=>x[1])])).rows[0];
  if(!p){await getBoard(ownerId,id);throw new BoardError(409,"The board changed. Read it again before applying edits");}
  return {board:view(p)};
}
export async function addReferences(ownerId:string,id:number,key:string,refs:Array<{url:string;title?:string}>){
  await getBoard(ownerId,id);
  const digest=hashToken(JSON.stringify(refs));
  // Serialize duplicate requests across replicas before downloading or saving assets.
  const uploaded:string[]=[];
  try {return await mcpTransaction(async c=>{
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))",[ownerId+":references:"+key]);
    const old=(await c.query("SELECT * FROM moodboard_tool_requests WHERE owner_id=$1 AND operation='references' AND request_key=$2",[ownerId,key])).rows[0];
    if(old){if(old.input_hash!==hashToken(id+":"+digest))throw new BoardError(409,"Request key already used with different references");return old.result;}
    const ingested=[];
    for(const ref of refs){
      const u=new URL(ref.url);if(u.protocol!=="https:")throw new BoardError(400,"References must use HTTPS");
      const image=await fetchRemoteImage(ref.url,12000);
      const asset=await ingestOwnedImage(ownerId,image.buffer,image.contentType);
      uploaded.push(asset.url);ingested.push({ref,asset});
    }
    // Lock only when ready to attach; remote image work does not block editor writes.
    const p=(await c.query("SELECT id FROM projects WHERE id=$1 AND user_id=$2 FOR UPDATE",[id,ownerId])).rows[0];
    if(!p)throw new BoardError(404,"Moodboard not found");
    const count=Number((await c.query("SELECT count(*) FROM pins WHERE project_id=$1",[id])).rows[0].count);
    if(count+refs.length>500)throw new BoardError(400,"A moodboard supports up to 500 references");
    let position=Number((await c.query("SELECT coalesce(max(position),-1)+1 AS n FROM pins WHERE project_id=$1",[id])).rows[0].n);
    const added=[];
    for(const {ref,asset} of ingested){
      const pin=(await c.query("INSERT INTO pins(project_id,image_path,image_url,source_url,title,width,height,position) VALUES($1,$2,$2,$3,$4,$5,$6,$7) RETURNING id,title,position",[id,asset.url,ref.url,ref.title||"Reference image",asset.width,asset.height,position++])).rows[0];
      added.push(pin);
    }
    await c.query("UPDATE projects SET updated_at=clock_timestamp() WHERE id=$1",[id]);
    const out={projectId:id,added};
    await c.query("INSERT INTO moodboard_tool_requests(owner_id,operation,request_key,input_hash,result) VALUES($1,'references',$2,$3,$4)",[ownerId,key,hashToken(id+":"+digest),out]);
    return out;
  });}catch(e){await Promise.allSettled(uploaded.map(path=>deleteOwnedAsset(ownerId,path)));throw e;}
}
