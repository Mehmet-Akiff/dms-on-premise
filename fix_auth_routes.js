const fs = require('fs');
let code = fs.readFileSync('backend/src/routes/auth.routes.js', 'utf8');

const nameChangeRegex = /if \(fullName && fullName !== user\.fullName\) \{[\s\S]*?await user\.save\(\);/m;
const newNameChangeCode = if (fullName && fullName !== user.fullName) {
      let targetEmail = user.role === 'ciso' ? user.email : cisoEmail;
      
      if (!targetEmail || targetEmail === 'ciso@dms.com') {
        return res.status(400).json({ error: "Sistemde CISO (Guvenlik Yoneticisi) e-postasi tanimli olmadigi icin onay maili gonderilemiyor." });
      }

      const waitSeconds = checkAndRecordEmailLimit(targetEmail, ip, user.role);
      if (waitSeconds > 0) {
        const minStr = waitSeconds >= 60 ? \\\\\$\\{Math.ceil(waitSeconds / 60)\\} dakika\\\ : \\\\\$\\{waitSeconds\\} saniye\\\;
        return res.status(429).json({ 
          error: 'E-posta limitine takildiniz.', 
          message: \\\Yeni bir onay maili gondermek icin lutfen \\$\\{minStr\\} bekleyin.\\\ 
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
          from: \\\"DMS Security" <\\$\\{fromUser\\}>\\\,
          to: targetEmail,
          subject: 'DMS - Ad Soyad Degisikligi Onay Talebi',
          text: \\\Kullanici \\$\\{user.username\\} (\\$\\{user.role\\}) gercek ismini "\\$\\{fullName\\}" yapmak istiyor.\\n\\nLutfen asagidaki 6 haneli guvenlik kodunu DMS Bildirim panelindeki ilgili alana girerek onaylayin:\\n\\nGuvenlik Kodu: \\$\\{token\\}\\\
        });
      } catch (mailErr) {
        console.warn('Onay maili gonderilemedi:', mailErr.message);
      }

      console.log(\\\\\n[NAME_CHANGE ONAY GUVENLIK KODU] Guvenlik Kodu: \\$\\{token\\}\\n\\\);
      return res.status(202).json({ 
        message: 'Isim degisikligi talebi alindi. E-posta onay kodu veya onay paneli bekleniyor.',
        pendingApproval: true,
        token
      });
    }

    await user.save();;

code = code.replace(nameChangeRegex, newNameChangeCode);
fs.writeFileSync('backend/src/routes/auth.routes.js', code, 'utf8');
