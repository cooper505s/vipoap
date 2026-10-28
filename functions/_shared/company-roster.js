// Named AI team agreed in the linked planning chat. These are directory records only.
export const companyRoster=[
 ['managing-director','Dan Stevens','human','Leadership','Managing Director',null,'launch','', 'Strategy, priorities and final human approval.'],
 ['olly','Olly','ai','Leadership','Operations Manager','managing-director','launch','British','Team leader, operational coordination and weekly management meetings.'],
 ['dylan','Dylan','ai','Technology & Development','Development Manager','olly','launch','British','Proactive fixes using Codex, urgent alerts and approved tested releases with rollback.'],
 ['molly','Molly','ai','Marketing & Growth','Marketing Manager','olly','launch','Australian','Recruitment-first weekly marketing plans; HQ approval for spending.'],
 ['rachel','Rachel','ai','Recruitment & Partners','Recruitment Manager','olly','launch','British','Onboarding and vetting; engineer activation remains HQ-only.'],
 ['sophie','Sophie','ai','Reception & Customer Experience','Receptionist','olly','launch','British','Planned 24/7 reception with verified HQ-only voice routing to AI managers.'],
 ['frank','Frank','ai','Finance & Business Performance','Finance Manager','olly','phase-2','British','Finance support; sensitive and financial actions require human approval.'],
 ['chloe','Chloe','ai','Reception & Customer Experience','Customer Care Manager','olly','phase-2','Irish','Customer care and customer experience support.'],
 ['ben','Ben','ai','Engineer Operations','Bookings Manager','olly','phase-2','British','Booking coordination within authorised rules and permissions.']
].map(([templateId,name,kind,team,jobTitle,reportsToTemplateId,phase,voiceProfile,responsibilities],index)=>({templateId,key:'staff:00000000-0000-4000-8000-'+String(index+1).padStart(12,'0'),name,kind,team,jobTitle,reportsToTemplateId,phase,voiceProfile,responsibilities}));
