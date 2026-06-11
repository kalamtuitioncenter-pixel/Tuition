// ═══ Kalam Tuition ERP — Google Apps Script v3.3 ════════════
// 1. Open Google Sheet → Extensions → Apps Script
// 2. Paste this entire code, replace SPREADSHEET_ID below
// 3. Deploy → New Deployment → Web App → Execute as: Me → Who has access: Anyone → Deploy
// 4. Copy the Web App URL → paste in ERP Settings → Backup & Sync

const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss   = SpreadsheetApp.openById(SPREADSHEET_ID);
    const ts   = new Date().toLocaleString('en-IN');

    // ── Students ──────────────────────────────────────────────
    overwriteSht(ss, 'Students',
      ['Time','ID','Adm No','Name','Grade','Parent','Phone','Course','Subjects','Fee','Adm Date','Status'],
      (data.students||[]).map(s=>[ts,s.id||'',s.admNo||'',s.name||'',s.grade||'',
        s.parent||'',s.phone||'',s.course||'',(s.subjects||[]).join?s.subjects.join(','):s.subjects||'',
        s.fee||0,s.admDate||'',s.status||'active']));

    // ── Fees ──────────────────────────────────────────────────
    overwriteSht(ss, 'Fees',
      ['Time','Receipt','Student','Month','Total','Paid','Balance','Mode','Status','Type','Paid On'],
      (data.fees||[]).map(f=>[ts,f.rcpt||'',f.student||'',f.month||'',
        f.total||0,f.paid||0,f.balance||0,f.mode||'Cash',
        f.status||'pending',f.type||'monthly',f.paidOn||'']));

    // ── Staff ─────────────────────────────────────────────────
    overwriteSht(ss, 'Staff',
      ['Time','ID','Name','Role','Phone','Base Salary','Consolidated Pay','Status'],
      (data.staff||[]).map(s=>[ts,s.id||'',s.name||'',s.role||'',
        s.phone||'',s.baseSalary||0,s.consolidatedPay||s.baseSalary||0,s.status||'active']));

    // ── Batches ───────────────────────────────────────────────
    overwriteSht(ss, 'Batches',
      ['Time','ID','Name','Grade','Session','Days','Fee','Teacher'],
      (data.batches||[]).map(b=>[ts,b.id||'',b.name||'',b.grade||'',
        b.session||'',(b.days||[]).join(','),b.fee||0,b.teacher||'']));

    // ── Exams ─────────────────────────────────────────────────
    overwriteSht(ss, 'Exams',
      ['Time','ID','Exam Name','Subject','Type','Date','Full Marks','Pass Marks','Batch'],
      (data.exams||[]).map(ex=>[ts,ex.id||'',ex.name||'',ex.subject||'',
        ex.type||'',ex.date||'',ex.maxMarks||100,ex.passMarks||35,ex.batch||'All']));

    // ── Marks ─────────────────────────────────────────────────
    const markRows = [];
    Object.entries(data.marks||{}).forEach(([examKey, val])=>{
      if (!val || typeof val !== 'object') return;
      const examName = val.examName||examKey;
      const subject  = val.subject||'';
      const maxMarks = val.maxMarks||100;
      const passMarks= val.passMarks||35;
      if (val.marks && typeof val.marks === 'object') {
        // Full exam record: { examId, examName, marks: { studentId: {marks, absent, pass} } }
        const stu = data.students||[];
        Object.entries(val.marks).forEach(([sid,m])=>{
          const s = stu.find(x=>x.id===sid)||{};
          const score = typeof m==='object'? m.marks : m;
          const absent= typeof m==='object'? (m.absent?'Yes':'No') : 'No';
          const pass  = typeof m==='object'? (m.pass?'Pass':'Fail') : '';
          markRows.push([ts,examKey,examName,subject,maxMarks,passMarks,sid,s.name||'',score,absent,pass]);
        });
      } else {
        markRows.push([ts,examKey,examName,subject,maxMarks,passMarks,'','',val,'','']);
      }
    });
    if (markRows.length>0)
      overwriteSht(ss,'Marks',
        ['Time','Exam Key','Exam Name','Subject','Max Marks','Pass Marks','Student ID','Student Name','Score','Absent','Result'],
        markRows);

    // ── Attendance ────────────────────────────────────────────
    const attRows = [];
    // Use full attendance store (all _erp_att_* keys)
    Object.entries(data.attendanceFull||data.attendance||{}).forEach(([key,val])=>{
      if (key === '_erp_att_index') return;
      // Each value is an object like { "studentId|batchId|session": "P"/"A"/"L" }
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        // Parse date/batch/session from key: _erp_att_{date}_{batchId}_{session}
        const keyParts = key.replace('_erp_att_','').split('_');
        const date     = keyParts[0]||'';
        const batch    = keyParts.slice(1,-1).join('_')||'';
        const session  = keyParts[keyParts.length-1]||'';
        Object.entries(val).forEach(([k,status])=>{
          const parts = k.split('|');
          const stuId = parts[0]||'';
          const stu   = (data.students||[]).find(s=>s.id===stuId)||{};
          attRows.push([ts,date,batch,session,stuId,stu.name||'',status]);
        });
      } else {
        attRows.push([ts,key,'','','','',String(val||'')]);
      }
    });
    if (attRows.length>0)
      overwriteSht(ss,'Attendance',
        ['Time','Date','Batch','Session','Student ID','Student Name','Status'],
        attRows.slice(0,3000));

    // ── Day Order ─────────────────────────────────────────────
    const dayOrderRows = [];
    const dayOrderMap = data.dayOrder||{};
    Object.entries(dayOrderMap).forEach(([dayNum, subjects])=>{
      const subjList = Array.isArray(subjects) ? subjects : [subjects];
      subjList.forEach((subj,i)=>{
        dayOrderRows.push([ts, dayNum, i+1, subj||'']);
      });
    });
    overwriteSht(ss,'DayOrder',
      ['Time','Day Number','Subject Order','Subject Name'],
      dayOrderRows);

    // ── Timetables ────────────────────────────────────────────
    const ttRows = [];
    Object.entries(data.timetables||{}).forEach(([key,val])=>{
      if (!val || typeof val!=='object') return;
      const batchName = key.replace('_erp_tt_','');
      // val.days is an array of { dayName, subjects: [] }
      if (Array.isArray(val.days)) {
        val.days.forEach((day,di)=>{
          (day.subjects||[]).forEach((subj,si)=>{
            ttRows.push([ts, batchName, di+1, day.dayName||('Day '+(di+1)), si+1, subj||'']);
          });
        });
      } else {
        ttRows.push([ts, batchName, '', '', '', JSON.stringify(val)]);
      }
    });
    if (ttRows.length>0)
      overwriteSht(ss,'Timetables',
        ['Time','Batch','Day Number','Day Name','Subject Order','Subject'],
        ttRows);

    // ── Salary Payments ───────────────────────────────────────
    const salArr = Array.isArray(data.salaryPayments)
      ? data.salaryPayments
      : Object.entries(data.salaryPayments||{}).map(([k,v])=>({key:k,...(typeof v==='object'?v:{amount:v})}));
    overwriteSht(ss,'Salary',
      ['Time','Key','Staff ID','Name','Month','Amount','Mode','Paid On','Note'],
      salArr.map(p=>[ts,p.key||'',p.staffId||'',p.name||'',
        p.month||'',p.amount||0,p.mode||'Cash',p.paidOn||p.date||'',p.note||'']));

    // ── Staff Attendance ───────────────────────────────────────
    const staffAttRows = [];
    Object.entries(data.staffAttendance||{}).forEach(([key,status])=>{
      const parts = String(key).split('|');
      const staffId = parts[0]||'';
      const date    = parts[1]||'';
      const session = parts[2]||'Full Day';
      const stf = (data.staff||[]).find(s=>s.id===staffId)||{};
      staffAttRows.push([ts,staffId,stf.name||'',date,session,status||'']);
    });
    if (staffAttRows.length>0)
      overwriteSht(ss,'StaffAttendance',
        ['Time','Staff ID','Staff Name','Date','Session','Status'],
        staffAttRows.slice(0,3000));

    // ── Notifications ─────────────────────────────────────────
    overwriteSht(ss,'Notifications',
      ['Time','ID','Type','Message','Date','Read'],
      (data.notifications||[]).map(n=>[ts,n.id||'',n.type||'',
        n.message||n.msg||'',n.date||'',n.read?'Yes':'No']));

    // ── Fee Structure ─────────────────────────────────────────
    const fsRows = Object.entries(data.feeStructure||{}).map(([grade,cfg])=>[ts,grade,
      cfg.monthlyFee||0,cfg.admFee||0,cfg.lateFee||0,cfg.subjectFee||0]);
    if (fsRows.length>0)
      overwriteSht(ss,'FeeStructure',
        ['Time','Grade','Monthly Fee','Adm Fee','Late Fee','Subject Fee'],
        fsRows);

    // ── Student Summary ───────────────────────────────────────
    const sumRows = [];
    Object.entries(data.studentSummary||{}).forEach(([key,val])=>{
      const clean  = key.replace('_erp_sum_','');
      const parts  = clean.split('_');
      const month  = parts.pop()||'';
      const year   = parts.pop()||'';
      const stuId  = parts.join('_');
      const stu    = (data.students||[]).find(s=>s.id===stuId)||{};
      sumRows.push([ts,stuId,stu.name||'',year,month,
        val.stars||0,(val.activities||[]).join(', '),val.note||'']);
    });
    if (sumRows.length>0)
      overwriteSht(ss,'StudentSummary',
        ['Time','Student ID','Student Name','Year','Month','Stars','Activities','Note'],
        sumRows);

    // ── WhatsApp Templates ────────────────────────────────────
    const waRows = [];
    Object.entries(data.waTemplates||{}).forEach(([k,v])=>waRows.push([ts,k.replace('_erp_wt_',''),v||'']));
    if (data.feeRcptTemplate) waRows.push([ts,'fee_receipt',data.feeRcptTemplate]);
    if (data.admTemplate)     waRows.push([ts,'admission',  data.admTemplate]);
    if (waRows.length>0)
      overwriteSht(ss,'Templates',['Time','Template Name','Template Text'],waRows);

    // ── AI / Reports / Diagnostic Data ────────────────────────
    const aiRows = [];
    Object.entries(data.aiData||{}).forEach(([k,v])=>{
      const val = typeof v==='object'? JSON.stringify(v): String(v||'');
      aiRows.push([ts, k, val.substring(0,50000)]);
    });
    if (aiRows.length>0)
      overwriteSht(ss,'AI_Data',['Time','Key','Data'],aiRows);

    // ── Settings ──────────────────────────────────────────────
    const center = data.center||{};
    overwriteSht(ss,'Settings',
      ['Time','Setting','Value'],[
        [ts,'center_name',    center.name    ||''],
        [ts,'center_phone',   center.phone   ||''],
        [ts,'center_address', center.address ||''],
        [ts,'center_email',   center.email   ||''],
        [ts,'adm_lang',       data.admLang   ||''],
        [ts,'fee_rcpt_lang',  data.feeRcptLang||''],
        [ts,'dark_mode',      data.darkMode  ||''],
        [ts,'lates_to_leave', data.latesToLeave||''],
        [ts,'last_monthly_reset',data.lastMonthlyReset||''],
        [ts,'backup_version', '3.3'],
        [ts,'sync_time',      ts],
      ]);

    // ── Log (append only — keeps history) ────────────────────
    logEntry(ss, ts, data, attRows.length, salArr.length, sumRows.length);

    return ContentService.createTextOutput(JSON.stringify({
      status:'ok', ts,
      counts:{
        students   : (data.students||[]).length,
        fees       : (data.fees||[]).length,
        staff      : (data.staff||[]).length,
        batches    : (data.batches||[]).length,
        exams      : (data.exams||[]).length,
        marks      : markRows.length,
        attendance : attRows.length,
        staffAttendance: staffAttRows.length,
        dayOrder   : dayOrderRows.length,
        timetables : ttRows.length,
        salary     : salArr.length,
        summary    : sumRows.length,
        templates  : waRows.length,
        ai         : aiRows.length,
      }
    })).setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService.createTextOutput(
      JSON.stringify({status:'error',msg:err.toString(),stack:err.stack||''})
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// Overwrite sheet data (keep header, replace all rows)
function overwriteSht(ss, name, headers, rows) {
  let s = ss.getSheetByName(name) || ss.insertSheet(name);
  if (s.getLastRow() === 0) {
    s.appendRow(headers);
    s.getRange(1,1,1,headers.length)
      .setFontWeight('bold').setBackground('#1a56db').setFontColor('#fff');
  } else {
    // Ensure header is correct
    s.getRange(1,1,1,headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#1a56db').setFontColor('#fff');
  }
  const last = s.getLastRow();
  if (last > 1) s.deleteRows(2, last - 1);
  if (rows && rows.length) {
    s.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

// Log — append only, keeps full sync history
function logEntry(ss, ts, data, attCount, salCount, sumCount) {
  let s = ss.getSheetByName('Log') || ss.insertSheet('Log');
  if (s.getLastRow() === 0) {
    s.appendRow(['Time','Center','Students','Fees','Staff','Batches','Exams','Attendance','Salary','Summary','Source']);
    s.getRange(1,1,1,11).setFontWeight('bold').setBackground('#1a56db').setFontColor('#fff');
  }
  s.appendRow([
    ts,
    (data.center&&data.center.name)||data.center||'KTC',
    (data.students||[]).length,
    (data.fees||[]).length,
    (data.staff||[]).length,
    (data.batches||[]).length,
    (data.exams||[]).length,
    attCount||0,
    salCount||0,
    sumCount||0,
    data.source||'manual'
  ]);
}