<template>
  <div class="settings-drawer-wrapper" :class="{ 'drawer-open': isOpen }">
    <div class="drawer-overlay" @click="closeDrawer"></div>
    <div class="settings-drawer" :class="'theme--' + currentUserRole">
      <!-- Header -->
      <div class="drawer-header">
        <div class="header-title">
          <span>⚙️</span>
          <h3>Kasa & Sistem Ayarları</h3>
        </div>
        <button class="btn-close-drawer" @click="closeDrawer">✕</button>
      </div>

      <!-- Scrollable Content -->
      <div class="drawer-body">
        
        <!-- 0. PROFIL KARTI -->
        <div class="profile-card-container">
          <div class="profile-avatar">
            <span v-if="currentUserRole === 'ciso'">🛡️</span>
            <span v-else-if="currentUserRole === 'admin'">🔑</span>
            <span v-else>👤</span>
          </div>
          <div class="profile-details">
            <span class="profile-role-tag" :class="'role--' + currentUserRole">
              {{ getRoleLabel(currentUserRole) }}
            </span>
            <h5>{{ currentUserFullName }}</h5>
            <p>@{{ currentUsername }}</p>
          </div>
        </div>

        <hr class="section-divider" />

        <!-- 1. PROFİL GÜNCELLEME (Bölümlenmiş Ayrı Formlar) -->
        <div class="settings-section">
          <h4>👤 Profil Bilgilerini Güncelle</h4>
          <p class="section-desc">Profil bilgilerinizi bölümler halinde güncelleyebilirsiniz. Yönetici adı ve kullanıcı adı değişikliği güvenlik nedeniyle CISO onayı gerektirir.</p>

          <!-- Form A: Ad Soyad Değiştirme -->
          <div class="sub-profile-section">
            <h5>Ad Soyad Değişikliği (Onay Gerekir)</h5>
            <form @submit.prevent="updateUserFullName" class="settings-form">
              <div class="form-group">
                <input v-model="userFullName" type="text" placeholder="Örn: Mehmet Akif Ürey" required />
              </div>
              <button type="submit" class="btn-settings-save">
                Ad Soyad Güncelleme Talebi Gönder
              </button>
            </form>
          </div>

          <div style="margin: 0.5rem 0; border-top: 1px dashed rgba(255,255,255,0.05);"></div>

          <!-- Form B: Kullanıcı Adı Değiştirme -->
          <div class="sub-profile-section">
            <h5>Kullanıcı Adı Değişikliği (Doğrudan Güncellenir)</h5>
            <form @submit.prevent="askConfirm('Kullanıcı adını güncellemek istediğinize emin misiniz?', updateUserUsername)" class="settings-form">
              <div class="form-group">
                <input v-model="userUsername" type="text" placeholder="Kullanıcı adı..." required />
              </div>
              <button type="submit" class="btn-settings-save">
                Kullanıcı Adını Güncelle
              </button>
            </form>
          </div>

          <div style="margin: 0.5rem 0; border-top: 1px dashed rgba(255,255,255,0.05);"></div>

          <!-- Form C: Şifre Değiştirme (Doğrudan) -->
          <div class="sub-profile-section">
            <h5>Şifre Değişikliği (Doğrudan Güncellenir)</h5>
            <form @submit.prevent="askConfirm('Şifrenizi güncellemek istediğinize emin misiniz?', updateUserPassword)" class="settings-form">
              <div class="form-group">
                <label>Mevcut Şifre</label>
                <div class="password-input-wrapper">
                  <input 
                    v-model="profileOldPassword" 
                    :type="isProfileOldPasswordVisible ? 'text' : 'password'" 
                    placeholder="Mevcut şifreniz..." 
                    required
                  />
                  <button 
                    type="button" 
                    class="btn-eye" 
                    @mousedown="isProfileOldPasswordVisible = true" 
                    @mouseup="isProfileOldPasswordVisible = false"
                    @mouseleave="isProfileOldPasswordVisible = false"
                    @touchstart="isProfileOldPasswordVisible = true" 
                    @touchend="isProfileOldPasswordVisible = false"
                  >
                    👁️
                  </button>
                </div>
              </div>

              <div class="form-group">
                <label>Yeni Şifre</label>
                <div class="password-input-wrapper">
                  <input 
                    v-model="profileNewPassword" 
                    :type="isProfileNewPasswordVisible ? 'text' : 'password'" 
                    placeholder="Yeni şifreniz..." 
                    required
                    :style="profileNewPassword ? { borderColor: isProfilePasswordValid ? '#22c55e' : '#ef4444' } : {}"
                  />
                  <button 
                    type="button" 
                    class="btn-eye" 
                    @mousedown="isProfileNewPasswordVisible = true" 
                    @mouseup="isProfileNewPasswordVisible = false"
                    @mouseleave="isProfileNewPasswordVisible = false"
                    @touchstart="isProfileNewPasswordVisible = true" 
                    @touchend="isProfileNewPasswordVisible = false"
                  >
                    👁️
                  </button>
                </div>
                <!-- Dinamik Şifre Gereksinimleri -->
                <div v-if="profileNewPassword && profilePasswordErrors.length > 0" class="password-requirements" style="font-size:0.68rem; color:#f87171; margin-top:0.25rem; display:flex; flex-direction:column; gap:0.15rem;">
                  <span v-for="err in profilePasswordErrors" :key="err">⚠️ {{ err }}</span>
                </div>
              </div>

              <div class="form-group">
                <label>Yeni Şifre Tekrar</label>
                <div class="password-input-wrapper">
                  <input 
                    v-model="profileNewPasswordConfirm" 
                    :type="isProfileNewPasswordConfirmVisible ? 'text' : 'password'" 
                    placeholder="Yeni şifrenizi tekrar girin..." 
                    required
                  />
                  <button 
                    type="button" 
                    class="btn-eye" 
                    @mousedown="isProfileNewPasswordConfirmVisible = true" 
                    @mouseup="isProfileNewPasswordConfirmVisible = false"
                    @mouseleave="isProfileNewPasswordConfirmVisible = false"
                    @touchstart="isProfileNewPasswordConfirmVisible = true" 
                    @touchend="isProfileNewPasswordConfirmVisible = false"
                  >
                    👁️
                  </button>
                </div>
              </div>

              <div v-if="profileNewPassword && profileNewPasswordConfirm && profileNewPassword !== profileNewPasswordConfirm" class="password-mismatch-banner">
                ⚠️ Şifreler eşleşmiyor!
              </div>

              <button type="submit" class="btn-settings-save" :disabled="!isProfilePasswordValid || (profileNewPassword !== profileNewPasswordConfirm)">
                Şifreyi Güncelle
              </button>
            </form>
          </div>

          <div style="margin: 0.5rem 0; border-top: 1px dashed rgba(255,255,255,0.05);"></div>

          <!-- Form D: E-posta Adresi Değiştirme (OTP ile) -->
          <div class="sub-profile-section">
            <h5>E-posta Adresi Değiştirme</h5>
            <p style="font-size:0.72rem; color:#9ca3af; margin:0 0 0.75rem;">Yeni e-postanıza bir doğrulama kodu gönderilecektir.</p>
            <form @submit.prevent="sendEmailOtp" class="settings-form" v-if="!emailOtpSent">
              <div class="form-group">
                <input v-model="userEmail" type="email" placeholder="Yeni e-posta adresiniz..." required />
              </div>
              <button type="submit" class="btn-settings-save" :disabled="isSendingEmailOtp">
                {{ isSendingEmailOtp ? 'Kod Gönderiliyor...' : 'Doğrulama Kodu Gönder' }}
              </button>
            </form>
            <div v-if="emailOtpSent" style="background: rgba(16, 185, 129, 0.05); border: 1px dashed rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 0.85rem; display:flex; flex-direction:column; gap:0.65rem;">
              <p style="font-size:0.72rem; color:#9ca3af; margin:0;"><strong style="color:#34d399;">{{ userEmail }}</strong> adresine kod gönderildi. 5 dakika geçerlidir.</p>
              <input 
                v-model="emailOtp" 
                type="text" 
                maxlength="6"
                placeholder="6 Haneli Kod"
                style="width:140px; height:38px; background:rgba(15,23,42,0.7); border:1.5px solid rgba(255,255,255,0.12); border-radius:6px; text-align:center; color:#fff; font-size:1.1rem; font-weight:700; outline:none; margin:0 auto;"
              />
              <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
                <button type="button" style="background:transparent; border:1px solid rgba(255,255,255,0.1); color:#9ca3af; padding:0.35rem 0.75rem; font-size:0.72rem; border-radius:6px; cursor:pointer;" @click="emailOtpSent=false; emailOtp=''; emailOtpTimer=0;">Vazgeç</button>
                <button type="button" style="background:#10b981; border:none; color:#fff; padding:0.35rem 1rem; font-size:0.72rem; font-weight:700; border-radius:6px; cursor:pointer;" @click="verifyEmailOtp">E-postayı Doğrula & Kaydet</button>
              </div>
            </div>
          </div>
        </div>

        <hr class="section-divider" />

        <!-- 2. ONAY BEKLEYEN DİĞER TALEPLER -->
        <div class="settings-section" v-if="isAdminOrCiso && otherApprovals.length > 0">
          <h4>⏳ Onay Bekleyen Profil & Sistem Talepleri</h4>
          <p class="section-desc">Profil ismi veya sistem dağıtım modu değişikliklerini onaylayın.</p>
          
          <div class="approvals-list-wrapper">
            <div v-for="req in otherApprovals" :key="req.id" class="approval-row-card">
              <div class="approval-info-brief">
                <span class="approval-type-badge">{{ getApprovalTypeLabel(req.type) }}</span>
                <p class="approval-detail-text">{{ getApprovalDetailText(req) }}</p>
                <div class="approval-status-badge-wrap" style="margin-top: 0.25rem;">
                  <span class="status-badge" :class="'status--' + req.status">
                    Durum: {{ getStatusLabel(req.status) }}
                  </span>
                </div>
                <small class="approval-meta-sub">
                  Verilen Onaylar: {{ req.approvalsReceived?.length > 0 ? req.approvalsReceived.join(', ') : 'Henüz onay verilmedi' }} ({{ req.approvalsReceived?.length || 0 }}/{{ req.approvalsRequired }} Onay)
                </small>
                
                <!-- Geri sayım sayacı gösterimi (NAME_CHANGE ise) -->
                <div v-if="req.type === 'NAME_CHANGE' && req.status === 'pending'" style="margin-top:0.4rem; font-size:0.7rem; color:#f59e0b; font-weight:600;">
                  ⏳ CISO Onayı İçin Kalan Süre: {{ getWorkingDaysCountdown(req.createdAt, req.requestData?.expiresAt) }}
                </div>
              </div>
              <div class="approval-actions" style="display:flex; gap:0.5rem; justify-content:flex-end; margin-top:0.5rem;" v-if="req.status === 'pending'">
                <button class="btn-approval btn-approval--reject" @click="askConfirm('Bu profil/sistem talebini reddetmek istediğinize emin misiniz?', () => handleApprovalAction(req.id, 'reject'))">Reddet</button>
                <button class="btn-approval btn-approval--approve" @click="askConfirm('Bu profil/sistem talebini onaylamak istediğinize emin misiniz?', () => handleApprovalAction(req.id, 'approve'))">Onayla</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 2B. YENİ KULLANICI BAŞVURULARI (Sadece Admin Yönetebilir) -->
        <div class="settings-section" v-if="currentUserRole === 'admin' && registrationApprovals.length > 0">
          <h4>🔔 Yeni Kullanıcı Başvuruları</h4>
          <p class="section-desc">Sisteme yeni kaydolmak isteyen kullanıcıların onay işlemlerini gerçekleştirin.</p>
          
          <div class="approvals-list-wrapper">
            <div v-for="req in registrationApprovals" :key="req.id" class="approval-row-card">
              <div class="approval-info-brief">
                <span class="approval-type-badge">{{ getApprovalTypeLabel(req.type) }}</span>
                <p class="approval-detail-text">{{ getApprovalDetailText(req) }}</p>
                <small class="approval-meta-sub">
                  Onay Verenler: {{ req.approvalsReceived?.length > 0 ? req.approvalsReceived.join(', ') : 'Henüz onay verilmedi' }} ({{ req.approvalsReceived?.length || 0 }}/{{ req.approvalsRequired }} Onay)
                </small>
              </div>
              <div class="approval-actions" style="display:flex; gap:0.5rem; justify-content:flex-end; margin-top:0.5rem;" v-if="req.status === 'pending'">
                <button class="btn-approval btn-approval--reject" @click="askConfirm('Bu kullanıcı başvurusunu reddetmek istediğinize emin misiniz?', () => handleApprovalAction(req.id, 'reject'))">Reddet</button>
                <button class="btn-approval btn-approval--approve" @click="askConfirm('Bu kullanıcı başvurusunu onaylamak istediğinize emin misiniz?', () => handleApprovalAction(req.id, 'approve'))">Onayla</button>
              </div>
            </div>
          </div>
        </div>

        <hr class="section-divider" v-if="isAdminOrCiso && approvalsList.length > 0" />

        <!-- 3. KASA KİMLİK & ŞİFRE BİLGİLERİ -->
        <div class="settings-section" v-if="currentUserRole === 'admin'">
          <h4>🔐 Kasa Yönetici Şifresi</h4>
          <p class="section-desc">Kasa kilidini açmak için kullanılan yönetici şifresini güncelleyin.</p>
          
          <form @submit.prevent="askConfirm('Kasa şifrenizi değiştirmek istediğinize emin misiniz?', updateKasaCredentials)" class="settings-form">
            
            <div class="form-group">
              <label>Yeni Şifre</label>
              <div class="password-input-wrapper">
                <input 
                  v-model="kasaNewPassword" 
                  :type="isNewPasswordVisible ? 'text' : 'password'" 
                  placeholder="Yeni şifre..." 
                  :style="kasaNewPassword ? { borderColor: isKasaPasswordValid ? '#22c55e' : '#ef4444' } : {}"
                />
                <button 
                  type="button" 
                  class="btn-eye" 
                  @mousedown="isNewPasswordVisible = true" 
                  @mouseup="isNewPasswordVisible = false"
                  @mouseleave="isNewPasswordVisible = false"
                  @touchstart="isNewPasswordVisible = true" 
                  @touchend="isNewPasswordVisible = false"
                >
                  👁️
                </button>
              </div>
              <!-- Dinamik Şifre Gereksinimleri -->
              <div v-if="kasaNewPassword && kasaPasswordErrors.length > 0" class="password-requirements" style="font-size:0.68rem; color:#f87171; margin-top:0.25rem; display:flex; flex-direction:column; gap:0.15rem;">
                <span v-for="err in kasaPasswordErrors" :key="err">⚠️ {{ err }}</span>
              </div>
            </div>

            <div class="form-group">
              <label>Yeni Şifre Tekrar</label>
              <div class="password-input-wrapper">
                <input 
                  v-model="kasaNewPasswordConfirm" 
                  :type="isNewPasswordConfirmVisible ? 'text' : 'password'" 
                  placeholder="Şifreyi tekrar girin..." 
                />
                <button 
                  type="button" 
                  class="btn-eye" 
                  @mousedown="isNewPasswordConfirmVisible = true" 
                  @mouseup="isNewPasswordConfirmVisible = false"
                  @mouseleave="isNewPasswordConfirmVisible = false"
                  @touchstart="isNewPasswordConfirmVisible = true" 
                  @touchend="isNewPasswordConfirmVisible = false"
                >
                  👁️
                </button>
              </div>
            </div>

            <div v-if="kasaNewPassword && kasaNewPasswordConfirm && kasaNewPassword !== kasaNewPasswordConfirm" class="password-mismatch-banner">
              ⚠️ Şifreler eşleşmiyor!
            </div>

            <button type="submit" class="btn-settings-save" :disabled="isSavingCreds || (kasaNewPassword !== kasaNewPasswordConfirm)">
              {{ isSavingCreds ? 'Kaydediliyor...' : 'Yönetici Şifresini Güncelle' }}
            </button>
          </form>
          <hr class="section-divider" />
        </div>

        <!-- 4. SİSTEM DAĞITIM MODU -->
        <div class="settings-section" v-if="isAdminOrCiso">
          <h4>🏢 Sistem Dağıtım Modu</h4>
          <p class="section-desc">Sistemin çalışma modunu belirleyin. Mod değişikliği TÜM yöneticilerin (Admin) ortak onayı sonrasında geçerli olur.</p>
          <div class="form-group">
            <label>Aktif Mod</label>
            <select v-model="systemMode" class="role-select" @change="askConfirm('Sistem modunu değiştirmek istediğinize emin misiniz?', updateSystemMode)">
              <option value="single_pc">💻 Tek Bilgisayar (Single PC)</option>
              <option value="network_sync">🌐 Şirket İçi Ağ (Network/Online Sync)</option>
            </select>
          </div>
          <hr class="section-divider" />
        </div>

        <!-- 5. KULLANICI YÖNETİMİ & DİNAMİK YETKİLENDİRME -->
        <div class="settings-section" v-if="isAdminOrCiso">
          <h4>👥 Kullanıcı Yönetimi & Dinamik İzinler</h4>
          <p class="section-desc">Çalışan izinlerini anlık olarak yönetin. CISO izinleri kilitlidir. Yöneticiler kendi yetkilerini düşüremezler.</p>
          
          <div class="users-list-wrapper">
            <div v-for="user in usersList" :key="user.id" class="user-row-card">
              <div class="user-info-brief">
                <strong>{{ user.fullName }}</strong>
                <span class="user-meta-sub">@{{ user.username }} ({{ user.email || 'E-posta yok' }})</span>
                <!-- CISO için Detay Butonu -->
                <button 
                  v-if="currentUserRole === 'ciso'" 
                  @click="openCisoDetail(user)" 
                  type="button"
                  style="margin-top:0.3rem; background:rgba(99,102,241,0.15); border:1px solid rgba(99,102,241,0.3); color:#a78bfa; padding:0.2rem 0.6rem; font-size:0.65rem; border-radius:4px; cursor:pointer; font-weight:600;"
                >
                  🔎 Detay Gör
                </button>
              </div>

              <div class="user-role-actions">
                <label class="perm-check-label">
                  <input 
                    type="checkbox" 
                    v-model="user.permissions.canRead" 
                    :disabled="user.role === 'ciso' || user.role === 'admin'"
                    @change="askConfirm('Okuma iznini değiştirmek istiyor musunuz?', () => togglePermission(user, 'canRead'))" 
                  />
                  <span>Oku</span>
                </label>
                <label class="perm-check-label">
                  <input 
                    type="checkbox" 
                    v-model="user.permissions.canWrite" 
                    :disabled="user.role === 'ciso' || user.role === 'admin'"
                    @change="askConfirm('Yazma iznini değiştirmek istiyor musunuz?', () => togglePermission(user, 'canWrite'))" 
                  />
                  <span>Yaz</span>
                </label>
                
                <!-- Yönetici kendi yetkisini düşüremez (disabled kuralı) -->
                <select 
                  v-model="user.role" 
                  class="user-role-select" 
                  :disabled="user.role === 'ciso' || (user.id === currentUserId && user.role === 'admin')"
                  @change="askConfirm('Kullanıcı rolünü değiştirmek istediğinize emin misiniz?', () => changeRole(user))"
                >
                  <option value="user">Standart</option>
                  <option value="admin">Yönetici</option>
                  <option v-if="user.role === 'ciso'" value="ciso">CISO</option>
                </select>
              </div>
            </div>
          </div>
          <hr class="section-divider" />
        </div>

        <!-- 6. E-POSTA BİLDİRİM VE ALARM AYARLARI -->
        <div class="settings-section" v-if="isAdminOrCiso">
          <h4>📧 Yetkisiz Erişim Alarmı</h4>
          <p class="section-desc">Hatalı şifre denemelerinde gönderilecek alarm limitini ayarlayın. Alarmlar, profilinizde tanımlı doğrulanmış e-postanıza gönderilecektir.</p>

          <div class="form-group" style="margin-bottom:1rem">
            <label>Hatalı Deneme Limiti (Alarm Eşiği)</label>
            <div class="threshold-selector">
              <select v-model="alertThreshold" @change="updateThreshold">
                <option :value="2">2 Deneme</option>
                <option :value="3">3 Deneme (Varsayılan)</option>
                <option :value="5">5 Deneme</option>
                <option :value="10">10 Deneme</option>
              </select>
            </div>
          </div>

          <div class="verification-status-box status--verified">
            <span class="status-dot"></span>
            <strong>Alarm E-posta Adresi:</strong>
            <p class="status-detail" style="margin-top:0.25rem; font-weight:700;">{{ verifiedEmail || 'Sistem Alarm Alıcısı' }}</p>
          </div>
        </div>

        <hr class="section-divider" v-if="isAdminOrCiso" />

        <!-- 7. SMTP GÖNDERİCİ AYARLARI -->
        <div class="settings-section" v-if="isAdminOrCiso">
          <h4>📨 SMTP Gönderici Ayarları</h4>
          <p class="section-desc">Onay ve alarm e-postalarını göndermek için kullanılacak SMTP hesabını doğrulayın.</p>
          
          <form @submit.prevent="askConfirm('SMTP gönderici ayarlarını doğrulamak ve kaydetmek istediğinize emin misiniz?', updateSmtpConfig)" class="settings-form">
            <div class="form-group">
              <label>Gönderici E-posta (User)</label>
              <input v-model="smtpUser" type="email" placeholder="orn: dms-bildirim@sirketiniz.com" required />
            </div>

            <div class="form-group">
              <label>SMTP Şifresi (Pass)</label>
              <input v-model="smtpPass" type="password" placeholder="Şifre..." />
            </div>

            <div v-if="smtpErrorText" class="mail-error-detail-banner" style="margin-bottom:0.5rem;">
              ⚠️ <strong>SMTP Hatası:</strong> {{ smtpErrorText }}
            </div>

            <button type="submit" class="btn-settings-save" :disabled="isSavingSmtp">
              {{ isSavingSmtp ? 'Göndericiyi Test Et ve Doğrula...' : 'Göndericiyi Test Et ve Doğrula' }}
            </button>
          </form>
        </div>

        <!-- 7B. LOG DOSYASI YÖNETİMİ (Sadece CISO ve Admin) -->
        <div class="settings-section" v-if="isAdminOrCiso">
          <h4>📁 Log Dosyası Yönetimi</h4>
          <p class="section-desc">Sistem işlem günlüklerinin yazılacağı fiziksel log dosyasını yapılandırın. Loglar arayüzden sıfırlanamaz, ancak yedek dosyaları yükleyebilirsiniz.</p>
          
          <div class="log-status-card" style="background: rgba(15, 23, 42, 0.6); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.08); margin-bottom: 1rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <p style="margin:0; font-size:0.8rem; color:#9ca3af;">Aktif Log Yolu:</p>
                <code style="font-size:0.75rem; color:#34d399; font-weight:700;">{{ logFilePath || '/app/uploads/dms-audit.jsonl' }}</code>
              </div>
              <span :style="{ background: logFileExists ? '#065f46' : '#991b1b', color: logFileExists ? '#34d399' : '#f87171', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: '700' }">
                {{ logFileExists ? 'BAĞLI' : 'DOSYA BULUNAMADI' }}
              </span>
            </div>
            
            <div v-if="!logFileExists" style="margin-top:1rem; border-top:1px dashed rgba(255,255,255,0.08); padding-top:0.75rem;">
              <p style="font-size:0.72rem; color:#ef4444; margin:0 0 0.5rem 0;">⚠️ Log dosyası disk üzerinde bulunamadı! Yeni bir kayıt dosyası oluşturmak ister misiniz?</p>
              <button type="button" class="btn-approval btn-approval--approve" @click="askConfirm('Yeni boş bir log dosyası oluşturmak istediğinize emin misiniz?', createLogFile)">
                Evet, Yeni Dosya Oluştur
              </button>
            </div>
          </div>

          <form @submit.prevent="askConfirm('Belirtilen log dosyasını içe aktarmak ve log yolunu değiştirmek istediğinize emin misiniz?', importLogFile)" class="settings-form">
            <div class="form-group">
              <label>Önceki Log Dosya Yolunu Belirt (İçe Aktar)</label>
              <div style="display:flex; gap:0.5rem;">
                <input v-model="importFilePath" type="text" placeholder="Örn: /app/uploads/eski-audit.jsonl" required style="flex:1;" />
                <button type="submit" class="btn-settings-save" style="margin:0; padding:0.55rem 1rem; white-space:nowrap; font-size:0.75rem;">Dosyayı Yükle</button>
              </div>
            </div>
          </form>
        </div>
        
        <!-- 8. MESAİ SAATLERİ AYARI (Sadece Admin) -->
        <div class="settings-section" v-if="currentUserRole === 'admin'">
          <h4>🕒 CISO Onay Talebi Mesai Ayarı</h4>
          <p class="section-desc">CISO onay bekleyen taleplerin 3 iş günü geri sayım takibinde kullanılan günlük mesai saatlerini belirleyin.</p>
          <form @submit.prevent="askConfirm('Mesai saatlerini kaydetmek istediğinize emin misiniz?', saveWorkingHours)" class="settings-form">
            <div style="display:flex; gap:0.75rem;">
              <div class="form-group" style="flex:1;">
                <label>Mesai Başlangıcı</label>
                <input v-model="workingHoursStart" type="time" required />
              </div>
              <div class="form-group" style="flex:1;">
                <label>Mesai Bitişi</label>
                <input v-model="workingHoursEnd" type="time" required />
              </div>
            </div>
            <button type="submit" class="btn-settings-save" style="margin-top:0.5rem;">
              Saat Ayarlarını Kaydet
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>

  <!-- Global Onay Modalı (Tüm İşlemler İçin) -->
  <div v-if="isGlobalConfirmOpen" class="global-confirm-overlay" @click.self="cancelGlobalConfirm">
    <div class="global-confirm-card">
      <h4>⚠️ İşlemi Onayla</h4>
      <p>{{ globalConfirmMessage }}</p>
      <div style="display:flex; gap:0.75rem; justify-content:flex-end; margin-top:1.2rem;">
        <button class="btn-approval btn-approval--reject" @click="cancelGlobalConfirm">Vazgeç</button>
        <button 
          class="btn-approval btn-approval--approve" 
          :disabled="globalConfirmTimer > 0"
          @click="executeGlobalConfirm"
        >
          {{ globalConfirmTimer > 0 ? `Evet (${globalConfirmTimer}s)` : 'Evet, Devam Et' }}
        </button>
      </div>
    </div>
  </div>

  <!-- CISO Kullanıcı Detay Modalı -->
  <div v-if="cisoDetailModalOpen" class="global-confirm-overlay" style="z-index:13000;" @click.self="cisoDetailModalOpen = false">
    <div style="background:#111827; border:1px solid rgba(99,102,241,0.3); border-radius:14px; width:100%; max-width:680px; max-height:80vh; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 25px 50px rgba(0,0,0,0.7);">
      <div style="display:flex; justify-content:space-between; align-items:center; padding:1.25rem 1.5rem; border-bottom:1px solid rgba(255,255,255,0.08);">
        <div>
          <h4 style="margin:0; color:#a78bfa; font-size:1rem;">{{ cisoDetailUser?.fullName }} Kullanıcı Detayı</h4>
          <p style="margin:0.2rem 0 0; font-size:0.75rem; color:#6b7280;">@{{ cisoDetailUser?.username }} &bull; {{ cisoDetailUser?.email || 'E-posta yok' }}</p>
        </div>
        <button @click="cisoDetailModalOpen = false" style="background:transparent; border:1px solid rgba(255,255,255,0.1); color:#9ca3af; padding:0.3rem 0.75rem; border-radius:6px; cursor:pointer;">✕ Kapat</button>
      </div>
      <div style="padding:1.25rem 1.5rem; overflow-y:auto; display:flex; flex-direction:column; gap:0.75rem;">
        <!-- Kullanıcı Bilgi Kartı -->
        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:8px; padding:1rem; display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
          <div><span style="font-size:0.68rem; color:#6b7280;">Ad Soyad</span><p style="margin:0.1rem 0 0; font-size:0.82rem; font-weight:700; color:#fff;">{{ cisoDetailUser?.fullName }}</p></div>
          <div><span style="font-size:0.68rem; color:#6b7280;">Kullanıcı Adı</span><p style="margin:0.1rem 0 0; font-size:0.82rem; font-weight:700; color:#fff;">@{{ cisoDetailUser?.username }}</p></div>
          <div><span style="font-size:0.68rem; color:#6b7280;">E-posta</span><p style="margin:0.1rem 0 0; font-size:0.82rem; color:#34d399;">{{ cisoDetailUser?.email || '—' }}</p></div>
          <div><span style="font-size:0.68rem; color:#6b7280;">Rol</span><p style="margin:0.1rem 0 0; font-size:0.82rem; color:#a78bfa; font-weight:700;">{{ getRoleLabel(cisoDetailUser?.role) }}</p></div>
          <div><span style="font-size:0.68rem; color:#6b7280;">Durum</span><p style="margin:0.1rem 0 0; font-size:0.82rem;" :style="{ color: cisoDetailUser?.status === 'active' ? '#34d399' : '#f87171' }">{{ cisoDetailUser?.status === 'active' ? 'Aktif' : 'Pasif' }}</p></div>
          <div><span style="font-size:0.68rem; color:#6b7280;">Kayıt Tarihi</span><p style="margin:0.1rem 0 0; font-size:0.82rem; color:#9ca3af;">{{ cisoDetailUser?.createdAt ? new Date(cisoDetailUser.createdAt).toLocaleDateString('tr-TR') : '—' }}</p></div>
        </div>
        
        <!-- İşlem Logları -->
        <div>
          <h5 style="margin:0 0 0.5rem; font-size:0.78rem; color:#9ca3af; font-weight:600;">SON 50 İŞLEM</h5>
          <div v-if="isLoadingCisoDetail" style="text-align:center; padding:1.5rem; color:#6b7280; font-size:0.8rem;">Yükleniyor...</div>
          <div v-else-if="cisoDetailLogs.length === 0" style="text-align:center; padding:1.5rem; color:#6b7280; font-size:0.8rem;">Bu kullanıcıya ait kayıtlı işlem bulunamadı.</div>
          <div v-else style="display:flex; flex-direction:column; gap:0.35rem; max-height:280px; overflow-y:auto; padding-right:0.5rem;">
            <div 
              v-for="log in cisoDetailLogs" 
              :key="log.id"
              style="background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.05); border-radius:6px; padding:0.6rem 0.75rem; display:grid; grid-template-columns:auto 1fr auto; gap:0.5rem; align-items:start;"
            >
              <span style="font-size:0.85rem;">{{ getActionIcon(log.action) }}</span>
              <div>
                <p style="margin:0; font-size:0.73rem; color:#fff; font-weight:600;">{{ getActionLabel(log.action) }}</p>
                <p style="margin:0.1rem 0 0; font-size:0.65rem; color:#6b7280;">{{ log.details || '—' }}</p>
              </div>
              <span style="font-size:0.62rem; color:#6b7280; white-space:nowrap;">{{ formatDetailDate(log.createdAt || log.created_at) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted } from 'vue'
import { useToast } from 'vue-toastification'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const toast = useToast()

const kasaUsername = ref('')
const kasaNewPassword = ref('')
const kasaNewPasswordConfirm = ref('')

const isNewPasswordVisible = ref(false)
const isNewPasswordConfirmVisible = ref(false)

const userFullName = ref('')
const userUsername = ref('')

const profileOldPassword = ref('')
const profileNewPassword = ref('')
const profileNewPasswordConfirm = ref('')
const isProfileOldPasswordVisible = ref(false)
const isProfileNewPasswordVisible = ref(false)
const isProfileNewPasswordConfirmVisible = ref(false)

const systemMode = ref('single_pc')
const usersList = ref([])
const approvalsList = ref([])

// E-posta Değiştirme
const userEmail = ref('')
const emailOtp = ref('')
const emailOtpSent = ref(false)
const emailOtpTimer = ref(0)
const isSendingEmailOtp = ref(false)
let emailOtpInterval = null

// CISO Kullanıcı Detay Modal
const cisoDetailModalOpen = ref(false)
const cisoDetailUser = ref(null)
const cisoDetailLogs = ref([])
const isLoadingCisoDetail = ref(false)

async function openCisoDetail(user) {
  cisoDetailUser.value = user;
  cisoDetailLogs.value = [];
  cisoDetailModalOpen.value = true;
  isLoadingCisoDetail.value = true;
  try {
    const response = await fetch(`/api/auth/users/${user.id}/detail`, {
      headers: { 'Authorization': `Bearer ${getKasaToken()}` }
    });
    if (response.ok) {
      const data = await response.json();
      cisoDetailLogs.value = data.logs || [];
    }
  } catch (e) {
    toast.error('Kullanıcı detayları yüklenemedi.');
  } finally {
    isLoadingCisoDetail.value = false;
  }
}

function formatDetailDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function getActionIcon(action) {
  const icons = { UPLOAD: '📤', UPDATE: '✏️', DELETE: '🗑️', FORCE_DELETE: '💀', RESTORE: '♻️', BULK_DELETE: '📦', LOGIN: '🔑', LOGOUT: '🔒', PASSWORD_UPDATE: '🔐', EMAIL_UPDATE: '📧', USERNAME_UPDATE: '👤', NAME_CHANGE: '📝' };
  return icons[action] || '📋';
}

function getActionLabel(action) {
  const labels = { UPLOAD: 'Yükleme', UPDATE: 'Güncelleme', DELETE: 'Silme', FORCE_DELETE: 'Kalıcı Silme', RESTORE: 'Geri Yükleme', BULK_DELETE: 'Toplu Silme', LOGIN: 'Giriş', LOGOUT: 'Çıkış', PASSWORD_UPDATE: 'Şifre Değişikliği', EMAIL_UPDATE: 'E-posta Değişikliği', USERNAME_UPDATE: 'Kullanıcı Adı Değişikliği', NAME_CHANGE: 'İsim Değişikliği' };
  return labels[action] || action;
}

const alertEmail = ref('')
const verifiedEmail = ref('')
const alertThreshold = ref(3)
const isEmailVerified = ref(false)

const smtpHost = ref('smtp.gmail.com')
const smtpPort = ref(465)
const smtpSecure = ref(true)
const smtpUser = ref('')
const smtpPass = ref('')

const mailErrorDetail = ref('')
const smtpErrorText = ref('')

const isSavingCreds = ref(false)
const isSendingCode = ref(false)
const isVerifying = ref(false)
const isSavingSmtp = ref(false)

const getKasaToken = () => localStorage.getItem('token') || ''

// Alarm Mail Doğrulama Kodu
const verificationCode = ref('')

// Genel Onay Modalı Değişkenleri
const isGlobalConfirmOpen = ref(false)
const globalConfirmMessage = ref('')
const globalConfirmTimer = ref(0)
let globalConfirmAction = null
let globalConfirmInterval = null

function askConfirm(message, action) {
  globalConfirmMessage.value = message;
  globalConfirmAction = action;
  isGlobalConfirmOpen.value = true;
  globalConfirmTimer.value = 1; // 1 saniye inaktif
  if (globalConfirmInterval) clearInterval(globalConfirmInterval);
  globalConfirmInterval = setInterval(() => {
    if (globalConfirmTimer.value > 0) {
      globalConfirmTimer.value--;
    } else {
      clearInterval(globalConfirmInterval);
    }
  }, 1000);
}

function executeGlobalConfirm() {
  isGlobalConfirmOpen.value = false;
  if (globalConfirmAction) globalConfirmAction();
}

function cancelGlobalConfirm() {
  isGlobalConfirmOpen.value = false;
  fetchUsers();
  fetchSettings();
}

// Mesai Saatleri Değişkenleri
const workingHoursStart = ref('09:00')
const workingHoursEnd = ref('18:00')

// Log Dosyası Yönetim Değişkenleri
const logFileExists = ref(true)
const logFilePath = ref('')
const importFilePath = ref('')

// Bölümlenmiş onay listeleri
const registrationApprovals = computed(() => {
  return approvalsList.value.filter(req => req.type === 'STANDARD_USER_CREATION' || req.type === 'ADMIN_CREATION')
})

const otherApprovals = computed(() => {
  return approvalsList.value.filter(req => req.type !== 'STANDARD_USER_CREATION' && req.type !== 'ADMIN_CREATION')
})

// Profil Bilgileri
const currentUserRole = ref('')
const currentUserFullName = ref('')
const currentUsername = ref('')
const currentUserId = ref('')

// Dinamik Şifre Validasyonları
const regPasswordErrors = computed(() => {
  const p = profileNewPassword.value || '';
  const errors = [];
  if (p.length < 8) errors.push('En az 8 karakter olmalı');
  if (!/[a-zA-Z]/.test(p)) errors.push('En az bir harf içermeli');
  if (!/[0-9]/.test(p)) errors.push('En az bir rakam içermeli');
  return errors;
})

const isProfilePasswordValid = computed(() => {
  return profileNewPassword.value && regPasswordErrors.value.length === 0;
})

const kasaPasswordErrors = computed(() => {
  const p = kasaNewPassword.value || '';
  const errors = [];
  if (p.length < 8) errors.push('En az 8 karakter olmalı');
  if (!/[a-zA-Z]/.test(p)) errors.push('En az bir harf içermeli');
  if (!/[0-9]/.test(p)) errors.push('En az bir rakam içermeli');
  return errors;
})

const isKasaPasswordValid = computed(() => {
  return kasaNewPassword.value && kasaPasswordErrors.value.length === 0;
})

const profilePasswordErrors = computed(() => {
  return regPasswordErrors.value;
})

function updateProfileInfo() {
  const token = getKasaToken();
  if (!token) return;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(window.atob(base64));
    currentUserRole.value = payload.role || '';
    currentUserFullName.value = payload.fullName || payload.username || '';
    currentUsername.value = payload.username || '';
    currentUserId.value = payload.id || '';

    // Form alanlarına doldur
    userFullName.value = payload.fullName || '';
    userUsername.value = payload.username || '';
  } catch (e) {
    console.error('[Settings] Profil parse hatası:', e);
  }
}

function getRoleLabel(role) {
  if (role === 'ciso') return '🛡️ CISO'
  if (role === 'admin') return '🔑 Yönetici'
  return '👤 Standart Kullanıcı'
}

// Rol kontrolü
const isAdminOrCiso = computed(() => {
  return currentUserRole.value === 'admin' || currentUserRole.value === 'ciso';
})

// Ayarları ve verileri çek
async function fetchSettings() {
  try {
    const response = await fetch('/api/auth/settings', {
      headers: {
        'Authorization': `Bearer ${getKasaToken()}`
      }
    })
    if (response.ok) {
      const data = await response.json()
      kasaUsername.value = data.settings.masterUsername
      alertEmail.value = data.settings.alertEmail || ''
      verifiedEmail.value = data.settings.verifiedAlertEmail || ''
      alertThreshold.value = data.settings.alertThreshold || 3
      isEmailVerified.value = data.settings.isEmailVerified || false
      systemMode.value = data.mode || 'single_pc'

      if (data.settings.smtpConfig) {
        smtpHost.value = data.settings.smtpConfig.host || 'smtp.gmail.com'
        smtpPort.value = data.settings.smtpConfig.port || 465
        smtpSecure.value = data.settings.smtpConfig.secure !== undefined ? data.settings.smtpConfig.secure : true
        smtpUser.value = data.settings.smtpConfig.auth?.user || ''
        smtpPass.value = data.settings.smtpConfig.auth?.pass || ''
      }
      if (data.settings.workingHours) {
        workingHoursStart.value = data.settings.workingHours.start || '09:00'
        workingHoursEnd.value = data.settings.workingHours.end || '18:00'
      }
    }

    if (isAdminOrCiso.value) {
      await fetchUsers()
      await fetchApprovals()
      await checkLogFileStatus()
    }
  } catch (error) {
    console.error('[Settings] Ayar çekme hatası:', error)
  }
}

// Kullanıcı Listesini Çek
async function fetchUsers() {
  try {
    const response = await fetch('/api/auth/users', {
      headers: { 'Authorization': `Bearer ${getKasaToken()}` }
    })
    if (response.ok) {
      const data = await response.json()
      usersList.value = data.users || []
    }
  } catch (error) {
    console.error('[Settings] Kullanıcı çekme hatası:', error)
  }
}

// Onay Listesini Çek
async function fetchApprovals() {
  try {
    const response = await fetch('/api/auth/approvals', {
      headers: { 'Authorization': `Bearer ${getKasaToken()}` }
    })
    if (response.ok) {
      const data = await response.json()
      approvalsList.value = data.approvals || []
    }
  } catch (error) {
    console.error('[Settings] Onay listesi çekme hatası:', error)
  }
}

// Talebi Arayüzden Onayla veya Reddet
async function handleApprovalAction(id, action) {
  try {
    const response = await fetch(`/api/auth/approvals/${id}/${action}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getKasaToken()}` }
    })
    const data = await response.json()
    if (response.ok) {
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('kasa_token', data.token);
        updateProfileInfo();
        window.dispatchEvent(new Event('kasa-unlocked'));
      }
      toast.success(data.message || 'İşlem tamamlandı.')
      await fetchApprovals()
      await fetchUsers()
    } else {
      toast.error(data.error || 'İşlem başarısız oldu.')
    }
  } catch (err) {
    toast.error('Onay işlemi gerçekleştirilemedi.')
  }
}

function getApprovalTypeLabel(type) {
  if (type === 'STANDARD_USER_CREATION') return '👤 Standart Kullanıcı Kaydı'
  if (type === 'ADMIN_CREATION') return '🔑 Yönetici Kaydı'
  if (type === 'NAME_CHANGE') return '📝 İsim Değişikliği'
  if (type === 'USERNAME_CHANGE') return '👤 Kullanıcı Adı Değişimi'
  if (type === 'MODE_CHANGE') return '🏢 Dağıtım Modu Değişimi'
  return type
}

function getApprovalDetailText(req) {
  if (req.type === 'STANDARD_USER_CREATION' || req.type === 'ADMIN_CREATION') {
    return `${req.requestData?.username} (${req.requestData?.email}) kayıt başvurusu yaptı.`
  }
  if (req.type === 'NAME_CHANGE') {
    return `Yönetici ismini "${req.requestData?.newFullName}" yapmak istiyor.`
  }
  if (req.type === 'USERNAME_CHANGE') {
    return `Yönetici kullanıcı adını "${req.requestData?.newUsername}" yapmak istiyor.`
  }
  if (req.type === 'MODE_CHANGE') {
    return `Sistem dağıtım modunu "${req.requestData?.mode === 'single_pc' ? 'Tek Bilgisayar' : 'Şirket İçi Ağ'}" yapmak istiyor.`
  }
  return ''
}

function getStatusLabel(status) {
  if (status === 'pending') return 'Bekleniyor'
  if (status === 'approved') return 'Onaylandı'
  if (status === 'rejected') return 'Onaylanmadı / Reddedildi'
  if (status === 'expired') return 'Onaylanmadı (Süresi Geçti)'
  return status
}

// 1. Ad Soyad Güncelleme (CISO Onaylı)
async function updateUserFullName() {
  try {
    const response = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getKasaToken()}`
      },
      body: JSON.stringify({ fullName: userFullName.value })
    })

    const data = await response.json()
    if (response.ok) {
      toast.success(data.message || 'Profil değişiklik talebi iletildi.')
      await fetchApprovals()
    } else {
      toast.error(data.error || 'Talep iletilemedi.')
    }
  } catch (e) {
    toast.error('İşlem sırasında hata oluştu.')
  }
}

// 2. Kullanıcı Adı Güncelleme (Doğrudan)
async function updateUserUsername() {
  try {
    const response = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getKasaToken()}`
      },
      body: JSON.stringify({ username: userUsername.value })
    })

    const data = await response.json()
    if (response.ok) {
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('kasa_token', data.token);
      }
      toast.success(data.message || 'Kullanıcı adı başarıyla güncellendi.')
      updateProfileInfo();
      window.dispatchEvent(new Event('kasa-unlocked'));
    } else {
      toast.error(data.error || 'Kullanıcı adı güncellenemedi.')
    }
  } catch (e) {
    toast.error('İşlem sırasında hata oluştu.')
  }
}

// 3. Şifre Güncelleme (Doğrudan)
async function updateUserPassword() {
  try {
    const response = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getKasaToken()}`
      },
      body: JSON.stringify({ 
        oldPassword: profileOldPassword.value, 
        newPassword: profileNewPassword.value 
      })
    })

    const data = await response.json()
    if (response.ok) {
      toast.success('Şifreniz başarıyla değiştirildi.')
      profileOldPassword.value = '';
      profileNewPassword.value = '';
      profileNewPasswordConfirm.value = '';
    } else {
      toast.error(data.error || 'Şifre güncellenemedi.')
    }
  } catch (e) {
    toast.error('İşlem sırasında hata oluştu.')
  }
}

// Yetkileri Güncelle
async function togglePermission(user, type) {
  try {
    const response = await fetch(`/api/auth/users/${user.id}/permissions`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getKasaToken()}`
      },
      body: JSON.stringify({
        permissions: {
          [type]: user.permissions[type]
        }
      })
    })
    if (!response.ok) {
      const data = await response.json()
      toast.error(data.error || 'Yetkiler güncellenemedi.')
      user.permissions[type] = !user.permissions[type]
    } else {
      toast.success('Yetkiler güncellendi.')
    }
  } catch (e) {
    user.permissions[type] = !user.permissions[type]
  }
}

// Rol Değiştir
async function changeRole(user) {
  try {
    const response = await fetch(`/api/auth/users/${user.id}/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getKasaToken()}`
      },
      body: JSON.stringify({ role: user.role })
    })
    if (response.ok) {
      toast.success('Kullanıcı rolü başarıyla güncellendi.')
      await fetchUsers()
    } else {
      const data = await response.json()
      toast.error(data.error || 'Kullanıcı rolü güncellenemedi.')
      await fetchUsers()
    }
  } catch (e) {
    // network error
  }
}

// Sistem Modu Güncelle
async function updateSystemMode() {
  try {
    const response = await fetch('/api/auth/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getKasaToken()}`
      },
      body: JSON.stringify({ mode: systemMode.value })
    })
    const data = await response.json()
    if (response.ok) {
      toast.success(data.message || 'Mod değişikliği talebi oluşturuldu.')
      await fetchApprovals()
    } else {
      toast.error(data.error || 'Mod güncellenemedi.')
    }
  } catch (e) {
    toast.error('Mod güncellenirken hata oluştu.')
  }
}

// Eşik Ayarını Güncelle
async function updateThreshold() {
  try {
    await fetch('/api/auth/settings', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getKasaToken()}`
      },
      body: JSON.stringify({ alertThreshold: alertThreshold.value })
    })
  } catch (error) {
    console.error('[Settings] Eşik güncelleme hatası:', error)
  }
}

// Kimlik Bilgilerini Güncelle (Kasa Şifresi)
async function updateKasaCredentials() {
  if (kasaNewPassword.value && !isKasaPasswordValid.value) {
    toast.warning('Şifreniz kurallara uygun değil.');
    return;
  }
  if (kasaNewPassword.value !== kasaNewPasswordConfirm.value) {
    toast.warning('Yeni şifreler birbiriyle eşleşmiyor!');
    return;
  }
  isSavingCreds.value = true
  try {
    const response = await fetch('/api/auth/settings', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getKasaToken()}`
      },
      body: JSON.stringify({
        masterUsername: kasaUsername.value,
        newPassword: kasaNewPassword.value ? kasaNewPassword.value : undefined
      })
    })

    if (response.ok) {
      kasaNewPassword.value = ''
      kasaNewPasswordConfirm.value = ''
      toast.success('Kasa yönetici kimlik bilgileri başarıyla güncellendi!')
    }
  } catch (error) {
    // ignored
  } finally {
    isSavingCreds.value = false
  }
}

// SMTP Ayarlarını Güncelle (Test Gönderim Korumalı)
async function updateSmtpConfig() {
  isSavingSmtp.value = true
  smtpErrorText.value = ''
  try {
    const response = await fetch('/api/auth/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getKasaToken()}`
      },
      body: JSON.stringify({
        smtpConfig: {
          host: smtpHost.value,
          port: smtpPort.value,
          secure: smtpSecure.value,
          auth: {
            user: smtpUser.value,
            pass: smtpPass.value
          }
        }
      })
    })

    const data = await response.json()
    if (response.ok) {
      toast.success('SMTP gönderici ayarları başarıyla doğrulandı ve kaydedildi!')
      fetchSettings()
    } else {
      smtpErrorText.value = data.message || 'SMTP doğrulaması başarısız. Bilgilerinizi kontrol edin.';
    }
  } catch (error) {
    smtpErrorText.value = 'Sunucuyla bağlantı kurulurken beklenmedik bir hata oluştu.';
  } finally {
    isSavingSmtp.value = false
  }
}

// Doğrulama Kodu Gönder
async function sendVerificationCode() {
  if (!alertEmail.value) return
  isSendingCode.value = true
  mailErrorDetail.value = ''

  try {
    const response = await fetch('/api/auth/send-verification', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getKasaToken()}`
      },
      body: JSON.stringify({ email: alertEmail.value })
    })

    const data = await response.json()

    if (response.ok) {
      isVerifying.value = true
      toast.info('Doğrulama kodu e-posta adresinize gönderildi.')
    } else {
      mailErrorDetail.value = `${data.error || 'Gönderim Hatası'}: ${data.message || ''}`
    }
  } catch (error) {
    mailErrorDetail.value = 'Sunucuyla bağlantı kurulamadı.'
  } finally {
    isSendingCode.value = false
  }
}

// E-posta Doğrulama Kodu Gönder (Profil e-posta değişikliği)
async function sendEmailOtp() {
  if (!userEmail.value) return;
  isSendingEmailOtp.value = true;
  emailOtpSent.value = false;
  emailOtp.value = '';
  try {
    const response = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getKasaToken()}`
      },
      body: JSON.stringify({ email: userEmail.value })
    });
    const data = await response.json();
    if (response.status === 202 && data.needsOtp) {
      emailOtpSent.value = true;
      toast.info('Doğrulama kodu yeni e-posta adresinize gönderildi.');
    } else if (response.ok) {
      // Beklenmedik başarı — zaten güncellendi
      toast.success(data.message || 'E-posta güncellendi.');
    } else {
      toast.error(data.error || 'Kod gönderilemedi.');
    }
  } catch (e) {
    toast.error('Sunucu bağlantısı kurulamadı.');
  } finally {
    isSendingEmailOtp.value = false;
  }
}

// E-posta OTP Doğrula & Kaydet
async function verifyEmailOtp() {
  if (!emailOtp.value || emailOtp.value.length !== 6) {
    toast.warning('Lütfen 6 haneli kodu girin.');
    return;
  }
  try {
    const response = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getKasaToken()}`
      },
      body: JSON.stringify({ email: userEmail.value, emailOtp: emailOtp.value })
    });
    const data = await response.json();
    if (response.ok) {
      toast.success('E-posta adresiniz başarıyla güncellendi!');
      emailOtpSent.value = false;
      emailOtp.value = '';
      userEmail.value = '';
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('kasa_token', data.token);
        updateProfileInfo();
        window.dispatchEvent(new Event('kasa-unlocked'));
      }
    } else {
      toast.error(data.error || 'Doğrulama başarısız.');
    }
  } catch (e) {
    toast.error('Sunucu bağlantısı kurulamadı.');
  }
}

// Alarm E-posta Kodu Doğrulama
async function verifyAlarmCode() {
  if (!verificationCode.value) return
  mailErrorDetail.value = ''
  try {
    const response = await fetch('/api/auth/verify-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getKasaToken()}`
      },
      body: JSON.stringify({ email: alertEmail.value, code: verificationCode.value })
    })
    const data = await response.json()
    if (response.ok) {
      toast.success('E-posta başarıyla doğrulandı ve kaydedildi.')
      isVerifying.value = false;
      verificationCode.value = '';
      fetchSettings();
    } else {
      mailErrorDetail.value = data.error || 'Doğrulama kodu geçersiz.';
    }
  } catch (e) {
    mailErrorDetail.value = 'Sunucuyla bağlantı kurulamadı.';
  }
}

// Mesai Saatlerini Kaydet (Sadece Admin)
async function saveWorkingHours() {
  try {
    const response = await fetch('/api/auth/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getKasaToken()}`
      },
      body: JSON.stringify({
        workingHours: { start: workingHoursStart.value, end: workingHoursEnd.value }
      })
    })
    if (response.ok) {
      toast.success('Mesai saatleri başarıyla kaydedildi.')
      fetchSettings();
    } else {
      toast.error('Mesai saatleri kaydedilemedi.')
    }
  } catch (e) {
    toast.error('Bağlantı hatası.')
  }
}

// Log Durumu Kontrolleri
async function checkLogFileStatus() {
  try {
    const response = await fetch('/api/auth/log-file-status', {
      headers: { 'Authorization': `Bearer ${getKasaToken()}` }
    })
    if (response.ok) {
      const data = await response.json()
      logFileExists.value = data.exists;
      logFilePath.value = data.path;
    }
  } catch (e) {
    // silent
  }
}

async function createLogFile() {
  try {
    const response = await fetch('/api/auth/create-log-file', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getKasaToken()}` }
    })
    if (response.ok) {
      toast.success('Yeni log kayıt dosyası oluşturuldu.')
      await checkLogFileStatus();
    } else {
      toast.error('Dosya oluşturulamadı.')
    }
  } catch (e) {
    toast.error('Hata oluştu.')
  }
}

async function importLogFile() {
  if (!importFilePath.value) {
    toast.warning('Lütfen bir dosya yolu girin.');
    return;
  }
  try {
    const response = await fetch('/api/auth/import-log-file', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getKasaToken()}`
      },
      body: JSON.stringify({ filePath: importFilePath.value })
    })
    const data = await response.json()
    if (response.ok) {
      toast.success(data.message || 'Log dosyası başarıyla yüklendi.')
      importFilePath.value = '';
      await checkLogFileStatus();
    } else {
      toast.error(data.error || 'Log dosyası içe aktarılamadı.')
    }
  } catch (e) {
    toast.error('Hata oluştu.')
  }
}

// CISO Onay Talebi Kalan Süre Sayacı
function getWorkingDaysCountdown(createdAtStr, expiresAtStr) {
  const now = new Date();
  const expiresAt = new Date(Number(expiresAtStr) || expiresAtStr);
  if (now >= expiresAt) {
    return 'SÜRE DOLDU (ZAMAN AŞIMI)';
  }
  const diffMs = expiresAt - now;
  const totalMins = Math.floor(diffMs / (60 * 1000));
  const days = Math.floor(totalMins / (24 * 60));
  const hours = Math.floor((totalMins % (24 * 60)) / 60);
  const mins = totalMins % 60;
  return `${days} gün ${hours} saat ${mins} dakika`;
}

function closeDrawer() {
  emit('close')
}

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    updateProfileInfo()
    fetchSettings()
  }
})

onMounted(() => {
  updateProfileInfo()
  if (props.isOpen) fetchSettings()
})
</script>

<style scoped>
.settings-drawer-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 9999;
}

.settings-drawer-wrapper.drawer-open {
  pointer-events: auto;
}

.drawer-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(3, 7, 18, 0.4);
  backdrop-filter: blur(4px);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.drawer-open .drawer-overlay {
  opacity: 1;
  pointer-events: auto;
}

.settings-drawer {
  position: absolute;
  top: 0;
  right: -620px;
  width: 100%;
  max-width: 600px;
  height: 100%;
  background: rgba(17, 24, 39, 0.94);
  display: flex;
  flex-direction: column;
  transition: right 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  backdrop-filter: blur(16px);
}

.drawer-open .settings-drawer {
  right: 0;
}

/* ============================================================
   ROL BAZLI TEMA STİLLERİ
   ============================================================ */
.settings-drawer.theme--user {
  border-left: 2px solid rgba(59, 130, 246, 0.3);
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5), -5px 0 15px rgba(59, 130, 246, 0.05);
}
.settings-drawer.theme--user h4 {
  color: #60a5fa;
}
.settings-drawer.theme--user .btn-settings-save {
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
}

.settings-drawer.theme--admin {
  border-left: 2px solid rgba(245, 158, 11, 0.3);
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5), -5px 0 15px rgba(245, 158, 11, 0.05);
}
.settings-drawer.theme--admin h4 {
  color: #fbbf24;
}
.settings-drawer.theme--admin .btn-settings-save {
  background: linear-gradient(135deg, #fbbf24, #d97706);
}

.settings-drawer.theme--ciso {
  border-left: 2px solid rgba(16, 185, 129, 0.3);
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5), -5px 0 15px rgba(16, 185, 129, 0.05);
}
.settings-drawer.theme--ciso h4 {
  color: #34d399;
}
.settings-drawer.theme--ciso .btn-settings-save {
  background: linear-gradient(135deg, #34d399, #059669);
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.header-title h3 {
  font-size: 1.05rem;
  font-weight: 700;
  color: #fff;
}

.btn-close-drawer {
  background: transparent;
  border: none;
  color: #9ca3af;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.drawer-body {
  flex-grow: 1;
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.profile-card-container {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 1rem;
}

.profile-avatar {
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.2);
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 1.4rem;
}

.profile-details {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.profile-role-tag {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  width: fit-content;
}
.profile-role-tag.role--user {
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #60a5fa;
}
.profile-role-tag.role--admin {
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: #fbbf24;
}
.profile-role-tag.role--ciso {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #34d399;
}

.profile-details h5 {
  color: #fff;
  font-size: 0.9rem;
  font-weight: 800;
}

.profile-details p {
  color: #9ca3af;
  font-size: 0.72rem;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.sub-profile-section {
  background: rgba(30, 41, 59, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-top: 0.4rem;
}

.sub-profile-section h5 {
  font-size: 0.76rem;
  font-weight: 700;
  color: #e2e8f0;
}

.section-desc {
  font-size: 0.74rem;
  color: #9ca3af;
  line-height: 1.4;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-group label {
  font-size: 0.72rem;
  font-weight: 600;
  color: #9ca3af;
}

.form-group input, .role-select {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 0.55rem 0.85rem;
  color: #fff;
  font-size: 0.8rem;
  outline: none;
  width: 100%;
}

.form-group input:focus, .role-select:focus {
  border-color: #8b5cf6;
  background: rgba(15, 23, 42, 0.8);
}

.email-input-group {
  display: flex;
  gap: 0.5rem;
}

.btn-send-code {
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.3);
  color: #a78bfa;
  padding: 0.5rem 1rem;
  font-size: 0.78rem;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
}

.btn-settings-save {
  color: #fff;
  border: none;
  padding: 0.6rem;
  font-size: 0.78rem;
  font-weight: 700;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-settings-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.section-divider {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.users-list-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 250px;
  overflow-y: auto;
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 0.5rem;
}

.user-row-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  padding: 0.6rem 0.8rem;
}

.user-info-brief {
  display: flex;
  flex-direction: column;
}

.user-info-brief strong {
  font-size: 0.8rem;
  color: #fff;
}

.user-meta-sub {
  font-size: 0.68rem;
  color: #9ca3af;
}

.user-role-actions {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  margin-top: 0.2rem;
  border-top: 1px solid rgba(255, 255, 255, 0.03);
  padding-top: 0.4rem;
}

.perm-check-label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.7rem;
  color: #d1d5db;
  cursor: pointer;
}

.perm-check-label input {
  cursor: pointer;
  accent-color: #8b5cf6;
}

.perm-check-label input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.user-role-select {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #fff;
  font-size: 0.68rem;
  padding: 0.2rem 0.45rem;
  border-radius: 4px;
  outline: none;
  cursor: pointer;
  margin-left: auto;
}

.user-role-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.approvals-list-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 250px;
  overflow-y: auto;
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 0.5rem;
}

.approval-row-card {
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(139, 92, 246, 0.15);
  border-radius: 6px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.approval-type-badge {
  font-size: 0.62rem;
  font-weight: 800;
  text-transform: uppercase;
  color: #a78bfa;
  background: rgba(139, 92, 246, 0.12);
  padding: 0.15rem 0.4;
  border-radius: 4px;
  width: fit-content;
}

.approval-detail-text {
  font-size: 0.74rem;
  color: #f3f4f6;
  line-height: 1.4;
}

.approval-status-badge-wrap {
  display: flex;
  align-items: center;
}

.status-badge {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
}

.status-badge.status--pending {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.status-badge.status--approved {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.status-badge.status--rejected {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.status-badge.status--expired {
  background: rgba(156, 163, 175, 0.15);
  color: #9ca3af;
  border: 1px solid rgba(156, 163, 175, 0.3);
}

.approval-meta-sub {
  font-size: 0.65rem;
  color: #9ca3af;
}

.btn-approval {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.3rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  border: none;
}

.btn-approval--approve {
  background: #10b981;
  color: #fff;
}

.btn-approval--reject {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #f87171;
}

.password-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input-wrapper input {
  padding-right: 2.5rem !important;
}

.btn-eye {
  position: absolute;
  right: 8px;
  background: transparent;
  border: none;
  color: #a78bfa;
  font-size: 0.95rem;
  cursor: pointer;
  padding: 4px;
  opacity: 0.6;
}

.btn-eye:hover {
  opacity: 1;
}

.password-mismatch-banner {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #f87171;
  font-size: 0.72rem;
  padding: 0.45rem 0.75rem;
  border-radius: 6px;
  text-align: center;
}

.verification-status-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 0.85rem;
  border-radius: 6px;
  font-size: 0.75rem;
  flex-wrap: wrap;
}

.verification-status-box.status--verified {
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.2);
  color: #4ade80;
}

.verification-status-box.status--unverified {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.status-detail {
  width: 100%;
  margin: 0.25rem 0 0 0;
  font-size: 0.7rem;
  opacity: 0.8;
}

.mail-error-detail-banner {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: #f87171;
  font-size: 0.74rem;
  padding: 0.65rem 0.85rem;
  border-radius: 6px;
  line-height: 1.4;
  word-break: break-word;
}

/* Genel Onay Modalı Stilleri */
.global-confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(3, 7, 18, 0.75);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 12000;
}
.global-confirm-card {
  background: #111827;
  border: 1px solid rgba(139, 92, 246, 0.25);
  border-radius: 12px;
  width: 100%;
  max-width: 380px;
  padding: 1.75rem;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
  text-align: center;
}
.global-confirm-card h4 {
  color: #a78bfa;
  font-size: 1.05rem;
  margin: 0 0 0.5rem 0;
}
.global-confirm-card p {
  color: #9ca3af;
  font-size: 0.82rem;
  line-height: 1.4;
  margin: 0 0 1.25rem 0;
}
</style>
