import type { Request, Response } from "express";
import { AttendanceService } from "../application/services/attendance-service.js";
import type {
  BreakEndInput,
  BreakStartInput,
  CheckInInput,
  CheckOutInput,
} from "../application/validators/attendance-schemas.js";
import { requireUserId } from "../common/middleware/auth.js";
import { sendSuccess } from "../common/responses/api-response.js";

export class AttendanceController {
  static async daily(request:Request,response:Response):Promise<void>{sendSuccess(response,await AttendanceService.daily(requireUserId(request),String(request.query.start),String(request.query.end)),"Lay lich su cham cong thanh cong");}
  static async breakActive(request:Request,response:Response):Promise<void>{sendSuccess(response,await AttendanceService.activeState(requireUserId(request)),"Lay phien nghi thanh cong");}
  static async breaksDaily(request:Request,response:Response):Promise<void>{const snapshot=await AttendanceService.getByDate(requireUserId(request),String(request.query.date));sendSuccess(response,snapshot.sessions.flatMap(s=>s.breaks),"Lay lich su nghi thanh cong");}
  static async updateBreak(request:Request,response:Response):Promise<void>{sendSuccess(response,await AttendanceService.updateBreak(requireUserId(request),request.params.id as string,request.body),"Cap nhat phien nghi thanh cong");}
  static async deleteBreak(request:Request,response:Response):Promise<void>{await AttendanceService.deleteBreak(requireUserId(request),request.params.id as string);response.status(204).send();}
  static async createSession(request:Request,response:Response):Promise<void>{sendSuccess(response,await AttendanceService.createManualSession(requireUserId(request),request.body),"Tao phien cham cong thanh cong",201);}
  static async updateSession(request:Request,response:Response):Promise<void>{sendSuccess(response,await AttendanceService.updateSession(requireUserId(request),request.params.id as string,request.body),"Cap nhat phien cham cong thanh cong");}
  static async deleteSession(request:Request,response:Response):Promise<void>{await AttendanceService.deleteSession(requireUserId(request),request.params.id as string);response.status(204).send();}
  static async cancelLatest(request:Request,response:Response):Promise<void>{sendSuccess(response,await AttendanceService.cancelLatest(requireUserId(request)),"Huy ban ghi gan nhat thanh cong");}
  static async resolveForgotten(request:Request,response:Response):Promise<void>{sendSuccess(response,await AttendanceService.resolveForgottenCheckout(requireUserId(request),request.body),"Da bo sung gio cham ra");}
  static async today(request: Request, response: Response): Promise<void> {
    sendSuccess(response, await AttendanceService.getToday(requireUserId(request)), "Lay cham cong hom nay thanh cong");
  }

  static async byDate(request: Request, response: Response): Promise<void> {
    sendSuccess(
      response,
      await AttendanceService.getByDate(requireUserId(request), request.params.date as string),
      "Lay chi tiet ngay cong thanh cong",
    );
  }

  static async active(request: Request, response: Response): Promise<void> {
    const snapshot = await AttendanceService.getToday(requireUserId(request));
    sendSuccess(
      response,
      { activeSession: snapshot.activeSession, activeBreak: snapshot.activeBreak, status: snapshot.status },
      "Lay trang thai cham cong thanh cong",
    );
  }

  static async checkIn(request: Request, response: Response): Promise<void> {
    sendSuccess(
      response,
      await AttendanceService.checkIn(requireUserId(request), request.body as CheckInInput),
      "Cham vao thanh cong",
    );
  }

  static async checkOut(request: Request, response: Response): Promise<void> {
    sendSuccess(
      response,
      await AttendanceService.checkOut(requireUserId(request), request.body as CheckOutInput),
      "Cham ra thanh cong",
    );
  }

  static async startBreak(request: Request, response: Response): Promise<void> {
    sendSuccess(
      response,
      await AttendanceService.startBreak(requireUserId(request), request.body as BreakStartInput),
      "Bat dau nghi giai lao thanh cong",
    );
  }

  static async endBreak(request: Request, response: Response): Promise<void> {
    sendSuccess(
      response,
      await AttendanceService.endBreak(requireUserId(request), request.body as BreakEndInput),
      "Ket thuc nghi giai lao thanh cong",
    );
  }
}
