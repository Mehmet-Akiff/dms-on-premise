const fs = require('fs');
let lines = fs.readFileSync('backend/src/routes/auth.routes.js', 'utf8').split('\n');
let startIdx = lines.findIndex(l => l.includes('if (fullName && fullName !== user.fullName) {'));
let endIdx = lines.findIndex((l, i) => i > startIdx && l.includes('await user.save();'));

if (startIdx !== -1 && endIdx !== -1) {
  let replacement = `    if (fullName && fullName !== user.fullName) {
      let targetEmail = user.role === 'ciso' ? user.email : cisoEmail;
      
      if (!targetEmail || targetEmail === 'ciso@dms.com') {
        return res.status(400).json({ error: "Sistemde CISO (Güvenlik Yöneticisi) e-postasý tanýmlý olmadýðý için onay maili gönderilemiyor." });
      }

      const waitSeconds = checkAndRecordEmailLimit(targetEmail, ip, user.role);
      if (waitSeconds > 0) {
        const minStr = waitSeconds >= 60 ? Math.ceil(waitSeconds / 60) + ' dakika' : waitSeconds + ' saniye';
        return res.status(429).json({ 
          error: 'E-posta limitine takýldýnýz.', 
          message: 'Yeni bir onay maili göndermek için lütfen ' + minStr + ' bekleyin.' 
        });
      }

      const token = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      await ApprovalRequest.create({
        type: 'NAME_CHANGE',
        targetId: user.id,
        requestData: { fullName: fullName, oldFullName: user.fullName, newFullName: fullName, expiresAt },
        approvalsRequired: 1,
        status: 'pending',
        token
      });

      try {
        const transporter = getMailTransporter(settings.smtpConfig);
        const fromUser = settings.smtpConfig?.auth?.user || 'security@dms.com';
        await transporter.sendMail({
          from: '"DMS Security" <' + fromUser + '>',
          to: targetEmail,
          subject: 'DMS - Ad Soyad Deðiþikliði Onay Talebi',
          text: 'Kullanýcý ' + user.username + ' (' + user.role + ') gerçek ismini "' + fullName + '" yapmak istiyor.\n\nLütfen aþaðýdaki 6 haneli güvenlik kodunu DMS Bildirim panelindeki ilgili alana girerek onaylayýn:\n\nGüvenlik Kodu: ' + token
        });
      } catch (mailErr) {
        console.warn('Onay maili gönderilemedi:', mailErr.message);
      }

      console.log('\n[NAME_CHANGE ONAY GÜVENLÝK KODU] Güvenlik Kodu: ' + token + '\n');
      return res.status(202).json({ 
        message: 'Ýsim deðiþikliði talebi alýndý. E-posta onay kodu veya onay paneli bekleniyor.',
        pendingApproval: true,
        token
      });
    }

    await user.save();`;

  lines.splice(startIdx, endIdx - startIdx + 1, replacement);
  fs.writeFileSync('backend/src/routes/auth.routes.js', lines.join('\n'), 'utf8');
  console.log("Successfully replaced NAME_CHANGE!");
} else {
  console.log("Could not find indices", startIdx, endIdx);
}
