import re

with open('backend/src/routes/auth.routes.js', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix NAME_CHANGE
pattern_name = re.compile(r'// 3\..*?Ýsim Deðiþikliði.*?if \(fullName && fullName !== user\.fullName\) \{.*?await user\.save\(\);', re.DOTALL | re.IGNORECASE)

new_name_code = """// 3. Ýsim Deðiþikliði (CISO Onayýna Gider)
    if (fullName && fullName !== user.fullName) {
      let targetEmail = user.role === 'ciso' ? user.email : cisoEmail;
      
      if (!targetEmail || targetEmail === 'ciso@dms.com') {
        return res.status(400).json({ error: "Sistemde CISO (Güvenlik Yöneticisi) e-postasý tanýmlý olmadýðý için onay maili gönderilemiyor." });
      }

      const waitSeconds = checkAndRecordEmailLimit(targetEmail, ip, user.role);
      if (waitSeconds > 0) {
        const minStr = waitSeconds >= 60 ? ${Math.ceil(waitSeconds / 60)} dakika : ${waitSeconds} saniye;
        return res.status(429).json({ 
          error: 'E-posta limitine takýldýnýz.', 
          message: Yeni bir onay maili göndermek için lütfen  bekleyin. 
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
          from: "DMS Security" <>,
          to: targetEmail,
          subject: 'DMS - Ad Soyad Deðiþikliði Onay Talebi',
          text: Kullanýcý  () gerçek ismini "" yapmak istiyor.\n\nLütfen aþaðýdaki 6 haneli güvenlik kodunu DMS Bildirim panelindeki ilgili alana girerek onaylayýn:\n\nGüvenlik Kodu: 
        });
      } catch (mailErr) {
        console.warn('Onay maili gönderilemedi:', mailErr.message);
      }

      console.log(\n[NAME_CHANGE ONAY GÜVENLÝK KODU] Güvenlik Kodu: \n);
      return res.status(202).json({ 
        message: 'Ýsim deðiþikliði talebi alýndý. E-posta onay kodu veya onay paneli bekleniyor.',
        pendingApproval: true,
        token
      });
    }

    await user.save();"""

# Since the file has corrupted characters, let's just find the if (fullName && fullName !== user.fullName) { and wait user.save(); indices
start_idx = code.find('if (fullName && fullName !== user.fullName) {')
end_idx = code.find('await user.save();', start_idx) + len('await user.save();')

if start_idx != -1 and end_idx != -1:
    code = code[:start_idx] + new_name_code + code[end_idx:]

with open('backend/src/routes/auth.routes.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Done")
