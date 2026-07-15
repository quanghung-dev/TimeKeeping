import { AppError } from "../../common/errors/app-error.js";
import { getPool } from "../../infrastructure/database/pool.js";
import { withTransaction } from "../../infrastructure/database/transaction.js";
import { AttendanceRepository } from "../../infrastructure/repositories/attendance-repository.js";
import { ProductivityRepository, type ProjectRow, type TaskRow } from "../../infrastructure/repositories/productivity-repository.js";
import type { JournalInput, ProjectInput, TaskInput } from "../validators/productivity-schemas.js";
function project(r:ProjectRow){return{id:r.id,name:r.name,color:r.color,description:r.description,isArchived:r.is_archived};}
function task(r:TaskRow){return{id:r.id,projectId:r.project_id,projectName:r.project_name,projectColor:r.project_color,title:r.title,description:r.description,taskDate:r.task_date,priority:r.priority,status:r.status,estimatedMinutes:r.estimated_minutes,trackedMinutes:r.tracked_minutes,activeTimerId:r.active_timer_id,completedAt:r.completed_at?.toISOString()??null};}
export class ProductivityService {
  static async projects(userId:string){return(await ProductivityRepository.projects(getPool(),userId)).map(project);}
  static async createProject(userId:string,i:ProjectInput){return project(await ProductivityRepository.createProject(getPool(),userId,i));}
  static async updateProject(userId:string,id:string,i:ProjectInput){const r=await ProductivityRepository.updateProject(getPool(),userId,id,i);if(!r)throw new AppError(404,"PROJECT_NOT_FOUND","Khong tim thay du an");return project(r);}
  static async deleteProject(userId:string,id:string){if(!(await ProductivityRepository.deleteProject(getPool(),userId,id)))throw new AppError(404,"PROJECT_NOT_FOUND","Khong tim thay du an");}
  static async tasks(userId:string,q:{date?:string;projectId?:string;status?:string}){return(await ProductivityRepository.tasks(getPool(),userId,q)).map(task);}
  static async createTask(userId:string,i:TaskInput){if(!(await ProductivityRepository.verifyProject(getPool(),userId,i.projectId)))throw new AppError(400,"PROJECT_INVALID","Du an khong hop le");const id=await ProductivityRepository.createTask(getPool(),userId,i);return(await this.tasks(userId,{date:i.taskDate})).find(x=>x.id===id)!;}
  static async updateTask(userId:string,id:string,i:TaskInput){if(!(await ProductivityRepository.verifyProject(getPool(),userId,i.projectId)))throw new AppError(400,"PROJECT_INVALID","Du an khong hop le");if(!(await ProductivityRepository.updateTask(getPool(),userId,id,i)))throw new AppError(404,"TASK_NOT_FOUND","Khong tim thay cong viec");return(await this.tasks(userId,{date:i.taskDate})).find(x=>x.id===id)!;}
  static async deleteTask(userId:string,id:string){if(!(await ProductivityRepository.deleteTask(getPool(),userId,id)))throw new AppError(404,"TASK_NOT_FOUND","Khong tim thay cong viec");}
  static async complete(userId:string,id:string){if(!(await ProductivityRepository.complete(getPool(),userId,id)))throw new AppError(404,"TASK_NOT_FOUND","Khong tim thay cong viec");return{completed:true};}
  static async startTimer(userId:string,id:string,entryType:"timer"|"pomodoro"="timer"){return withTransaction(async db=>{await AttendanceRepository.lockUser(db,userId);try{const row=await ProductivityRepository.startTimer(db,userId,id,entryType);if(!row)throw new AppError(404,"TASK_NOT_FOUND","Khong tim thay cong viec");return{id:row.id,startedAt:row.started_at.toISOString(),entryType};}catch(error){if(typeof error==="object"&&error&&"code" in error&&error.code==="23505")throw new AppError(409,"TIMER_ALREADY_ACTIVE","Da co bo dem cong viec dang chay");throw error;}});}
  static async stopTimer(userId:string,id:string){return withTransaction(async db=>{await AttendanceRepository.lockUser(db,userId);const row=await ProductivityRepository.stopTimer(db,userId,id);if(!row)throw new AppError(409,"NO_ACTIVE_TASK_TIMER","Cong viec khong co bo dem dang chay");return{id:row.id,startedAt:row.started_at.toISOString(),endedAt:row.ended_at.toISOString()};});}
  static async journals(userId:string,start:string,end:string){return ProductivityRepository.journals(getPool(),userId,start,end);}
  static async saveJournal(userId:string,i:JournalInput){return ProductivityRepository.upsertJournal(getPool(),userId,i);}
  static async summary(userId:string,start:string,end:string){const row=await ProductivityRepository.summary(getPool(),userId,start,end);const typed=row as {total_tasks:number;completed_tasks:number;tracked_minutes:number;average_score:string};return{totalTasks:typed.total_tasks,completedTasks:typed.completed_tasks,completionRate:typed.total_tasks?Math.round(typed.completed_tasks/typed.total_tasks*100):0,trackedMinutes:typed.tracked_minutes,averageScore:typed.average_score};}
}
