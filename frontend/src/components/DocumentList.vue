<template>
  <div class="doc-list">
    <div class="doc-list-header">
      <h2 class="doc-list-title">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        {{ isTrashView ? 'Çöp Kutusu (Silinen Belgeler)' : isSearchMode ? 'Arama Sonuçları' : 'Son Yüklenen Dokümanlar' }}
      </h2>
      <div class="doc-header-actions">
        <!-- Çöp Kutusu Butonu -->
        <button 
          class="trash-toggle-btn" 
          :class="{ 'trash-active': isTrashView }" 
          @click="toggleTrashView"
          :title="isTrashView ? 'Normal Belgeleri Göster' : 'Çöp Kutusunu Göster'"
        >
          <svg class="trash-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
          <span>{{ isTrashView ? 'Belgelere Dön' : 'Çöp Kutusu' }}</span>
        </button>

        <span v-if="isPolling && !isSearchMode && !isTrashView" class="polling-indicator" title="Otomatik güncelleme aktif">
          <span class="polling-dot"></span>
          Canlı
        </span>
        <span v-if="isSearchMode && !isTrashView" class="search-badge">
          "<strong>{{ searchQuery }}</strong>" için {{ documents.length }} sonuç
        </span>
        <span v-else class="doc-count">{{ documents.length }} doküman</span>
      </div>
    </div>

    <!-- Yükleniyor -->
    <div v-if="isLoading && documents.length === 0" class="doc-loading">
      <div class="spinner-sm"></div>
      <p>Dokümanlar yükleniyor...</p>
    </div>

    <!-- Toplu İşlem Barı -->
    <div v-if="selectedIds.length > 0 && isAdmin" class="bulk-action-bar">
      <span class="bulk-count">{{ selectedIds.length }} belge seçildi</span>
      <button class="action-btn action-btn--danger bulk-delete-btn" @click="triggerBulkDelete">
        🗑️ Seçilenleri Sil
      </button>
    </div>

    <!-- Tablo -->
    <div class="doc-table-wrap" v-if="documents.length > 0">
      <table class="doc-table">
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">
              <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" />
            </th>
            <th>Dosya Adı</th>
            <th>Kategori</th>
            <th>Tür</th>
            <th>Durum</th>
            <th>Tarih</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <!-- Kesin Eşleşmeler -->
          <template v-for="doc in primaryResults" :key="doc.id">
            <tr class="doc-row" :class="{ 'doc-row--selected': selectedIds.includes(doc.id) }">
              <td style="text-align: center;">
                <input type="checkbox" :value="doc.id" v-model="selectedIds" />
              </td>
              <td class="doc-name">
                <span class="doc-icon">{{ getFileIcon(doc.mimeType || doc.mime_type) }}</span>
                <span class="doc-name-text">{{ doc.originalName || doc.original_name }}</span>
                <span v-if="isSearchMode && doc.matchLocation" class="match-badge" :class="'match--' + doc.matchLocation">
                  {{ doc.matchLocation === 'filename' ? '📌 Adında' : '📄 İçerikte' }}
                </span>
              </td>
              <td>
                <span class="category-badge" :class="'cat--' + getCleanCategoryClass(doc.category || doc.metadata?.category)">
                  {{ getCleanCategoryLabel(doc.category || doc.metadata?.category) }}
                </span>
              </td>
              <td>
                <span class="type-badge">{{ getTypeLabel(doc.mimeType || doc.mime_type) }}</span>
              </td>
              <td>
                <span class="status-badge" :class="'status--' + (doc.status || '').toLowerCase()">
                  <span class="status-dot"></span>
                  {{ getStatusLabel(doc.status) }}
                </span>
              </td>
              <td class="doc-date">{{ formatDate(doc.createdAt || doc.created_at) }}</td>
              <td class="doc-actions">
                <!-- Çöp Kutusu Modu Aksiyonları -->
                <template v-if="isTrashView">
                  <button 
                    v-if="isAdmin"
                    class="action-btn action-btn--success" 
                    @click="restoreDocument(doc)"
                    title="Belgeyi Çöp Kutusundan Kurtar"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="23 4 23 10 17 10"></polyline>
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                    </svg>
                  </button>
                  <button 
                    v-if="isAdmin"
                    class="action-btn action-btn--danger" 
                    @click="triggerDelete(doc)"
                    title="Belgeyi Kalıcı Olarak Sil"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </template>

                <!-- Normal Liste Aksiyonları -->
                <template v-else>
                  <button
                    v-if="doc.status === 'COMPLETED'"
                    class="action-btn"
                    @click="openDetail(doc)"
                    title="OCR Metnini Görüntüle"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                  <span v-else-if="doc.status === 'PROCESSING'" class="action-hint">
                    <div class="spinner-xs"></div>
                  </span>
                  
                  <button 
                    v-if="doc.status !== 'PROCESSING' && isAdmin"
                    class="action-btn action-btn--danger" 
                    @click="triggerDelete(doc)"
                    title="Çöp Kutusuna Gönder"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </template>
              </td>
            </tr>
            <!-- Arama Highlight Satırı -->
            <tr v-if="isSearchMode && doc.highlight" class="doc-row-highlight">
              <td colspan="7">
                <div class="search-highlight" v-html="doc.highlight"></div>
              </td>
            </tr>
          </template>

          <!-- Olası Eşleşmeler Ayırıcı -->
          <tr v-if="isSearchMode && dimmedResults.length > 0 && primaryResults.length > 0" class="dimmed-separator-row">
            <td colspan="7">
              <div class="dimmed-separator">
                <div class="dimmed-separator-line"></div>
                <span class="dimmed-separator-text">💡 Olası Eşleşmeler ({{ dimmedResults.length }})</span>
                <div class="dimmed-separator-line"></div>
              </div>
            </td>
          </tr>

          <!-- Olası (Dimmed) Eşleşmeler -->
          <template v-for="doc in dimmedResults" :key="'dim-' + doc.id">
            <tr class="doc-row doc-row--dimmed" :class="{ 'doc-row--selected': selectedIds.includes(doc.id) }">
              <td style="text-align: center;">
                <input type="checkbox" :value="doc.id" v-model="selectedIds" />
              </td>
              <td class="doc-name">
                <span class="doc-icon">{{ getFileIcon(doc.mimeType || doc.mime_type) }}</span>
                <span class="doc-name-text">{{ doc.originalName || doc.original_name }}</span>
                <span v-if="doc.matchLocation" class="match-badge" :class="'match--' + doc.matchLocation">
                  {{ doc.matchLocation === 'filename' ? '📌 Adında' : '📄 İçerikte' }}
                </span>
              </td>
              <td>
                <span class="category-badge" :class="'cat--' + getCleanCategoryClass(doc.category || doc.metadata?.category)">
                  {{ getCleanCategoryLabel(doc.category || doc.metadata?.category) }}
                </span>
              </td>
              <td>
                <span class="type-badge">{{ getTypeLabel(doc.mimeType || doc.mime_type) }}</span>
              </td>
              <td>
                <span class="status-badge" :class="'status--' + (doc.status || '').toLowerCase()">
                  <span class="status-dot"></span>
                  {{ getStatusLabel(doc.status) }}
                </span>
              </td>
              <td class="doc-date">{{ formatDate(doc.createdAt || doc.created_at) }}</td>
              <td class="doc-actions">
                <!-- Çöp Kutusu Modu Aksiyonları -->
                <template v-if="isTrashView">
                  <button 
                    v-if="isAdmin"
                    class="action-btn action-btn--success" 
                    @click="restoreDocument(doc)"
                    title="Belgeyi Çöp Kutusundan Kurtar"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="23 4 23 10 17 10"></polyline>
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                    </svg>
                  </button>
                  <button 
                    v-if="isAdmin"
                    class="action-btn action-btn--danger" 
                    @click="triggerDelete(doc)"
                    title="Belgeyi Kalıcı Olarak Sil"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </template>

                <!-- Normal Liste Aksiyonları -->
                <template v-else>
                  <button
                    v-if="doc.status === 'COMPLETED'"
                    class="action-btn"
                    @click="openDetail(doc)"
                    title="OCR Metnini Görüntüle"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                  <span v-else-if="doc.status === 'PROCESSING'" class="action-hint">
                    <div class="spinner-xs"></div>
                  </span>
                  
                  <button 
                    v-if="doc.status !== 'PROCESSING' && isAdmin"
                    class="action-btn action-btn--danger" 
                    @click="triggerDelete(doc)"
                    title="Çöp Kutusuna Gönder"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </template>
              </td>
            </tr>
            <tr v-if="isSearchMode && doc.highlight" class="doc-row-highlight doc-row--dimmed">
              <td colspan="7">
                <div class="search-highlight" v-html="doc.highlight"></div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Boş Durum -->
    <div v-else class="doc-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3; margin-bottom:0.75rem">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
        <polyline points="13 2 13 9 20 9"/>
      </svg>
      <p>Henüz yüklenmiş doküman bulunmuyor.</p>
      <p class="doc-empty-sub">Sol panelden dosya yükleyerek başlayabilirsiniz.</p>
    </div>

    <!-- OCR Detay Modalı -->
    <Transition name="modal">
      <div v-if="selectedDoc" class="modal-overlay" @click.self="closeDetail">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title-wrap">
              <h3 class="modal-title">{{ selectedDoc.originalName || selectedDoc.original_name }}</h3>
              <span class="status-badge status--completed" style="font-size:0.72rem">
                <span class="status-dot"></span>
                {{ selectedDoc.status }}
              </span>
            </div>
            <div class="modal-header-actions" style="display:flex; align-items:center; gap:0.6rem">
              <!-- Orijinal Belgeyi İndir Butonu -->
              <a 
                :href="'/api/documents/' + selectedDoc.id + '/download'" 
                class="action-link-btn shadow-btn" 
                title="Orijinal Belgeyi Bilgisayara İndir"
                @click="trackAction('DOWNLOAD', selectedDoc.id, selectedDoc.originalName || selectedDoc.original_name, 'Belge indirildi.')"
              >
                📥 İndir
              </a>

              <!-- OCR Metnini Word Olarak İndir Butonu -->
              <a 
                v-if="detailData?.metadata?.extracted_text || detailData?.metadata?.extractedText"
                :href="'/api/documents/' + selectedDoc.id + '/export'" 
                class="action-link-btn shadow-btn accent-btn" 
                title="OCR Raporunu Word (.doc) Olarak İndir"
                @click="trackAction('EXPORT', selectedDoc.id, selectedDoc.originalName || selectedDoc.original_name, 'Belge Word (.doc) raporu indirildi.')"
              >
                📝 Raporu İndir (.doc)
              </a>
              
              <button class="modal-close" @click="closeDetail">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                   <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Meta Bilgiler (Kategori ve Dosya Yolu Kopyalama) -->
          <div class="modal-meta" v-if="detailData" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <div class="meta-item" v-if="detailData.metadata?.category">
              <span class="meta-label">Kategori:</span>
              <span class="meta-value">{{ getCleanCategoryLabel(detailData.metadata.category) }}</span>
            </div>
            <div class="meta-item file-path-brief" style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="meta-label">Dosya Konumu:</span>
              <span class="meta-value" style="font-family: monospace; font-size: 0.72rem; color: #a78bfa; background: rgba(167, 139, 250, 0.08); padding: 0.2rem 0.5rem; border-radius: 4px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ selectedDoc.filePath }}</span>
              <button 
                class="action-link-btn" 
                style="padding: 0.2rem 0.5rem; font-size: 0.7rem; border: 1px solid var(--border);"
                @click="copyFilePath(selectedDoc.filePath)"
              >
                📋 Kopyala
              </button>
            </div>
          </div>

          <!-- OCR Çıktısı ve Kaydırma Akışı -->
          <div class="modal-body">
            <div v-if="isLoadingDetail" class="modal-loading">
              <div class="spinner-sm"></div>
              <p>Yükleniyor...</p>
            </div>
            
            <!-- DÜZENLEME MODU (DocumentEditor) -->
            <div v-else-if="isEditing && selectedDoc" class="ocr-edit-mode">
              <DocumentEditor
                :documentId="selectedDoc.id"
                :initialText="detailData?.metadata?.extractedText || detailData?.metadata?.extracted_text || ''"
                @save="handleEditorSave"
                @cancel="handleEditorCancel"
              />
            </div>

            <!-- Kaydırma Akışı (Summary -> OCR Text -> Preview) -->
            <div v-else class="modal-scroll-flow" style="display: flex; flex-direction: column; gap: 1.5rem;">
              
              <!-- 1. Yapay Zeka Özeti -->
              <div class="summary-section" style="background: rgba(139, 92, 246, 0.05); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 8px; padding: 1.25rem;">
                <h5 style="margin-bottom: 0.5rem; font-size: 0.85rem; font-weight: 700; color: #a78bfa;">🤖 Yapay Zeka Belge Özeti</h5>
                <p style="font-size: 0.82rem; line-height: 1.5; color: var(--text-primary);">{{ aiSummary }}</p>
              </div>

              <!-- 2. Çıkarılan Tam Metin -->
              <div v-if="detailData?.metadata?.extracted_text || detailData?.metadata?.extractedText" class="ocr-output">
                <div class="ocr-header">
                  <span class="ocr-label">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>
                    </svg>
                    Çıkarılan Tam Metin (OCR)
                  </span>
                  
                  <div class="ocr-header-actions" style="display:flex; align-items:center; gap:0.75rem">
                    <button 
                      class="action-link-btn" 
                      style="border: 1px solid var(--border); background: rgba(139, 92, 246, 0.08); font-size: 0.75rem; padding: 0.35rem 0.65rem;"
                      @click="isEditing = true"
                      title="Metni Düzenle"
                    >
                      ✏️ Metin Düzenle
                    </button>
                    
                    <!-- Doküman içi arama çubuğu -->
                    <div class="doc-search-box">
                      <input
                        v-model="docSearchQuery"
                        type="text"
                        class="doc-search-input"
                        placeholder="Metin içinde ara..."
                        @input="onDocSearch"
                        @keydown.enter.prevent="nextMatch"
                      />
                      <div class="doc-search-nav" v-if="matchCount > 0">
                        <span class="doc-search-count">{{ activeMatchIndex + 1 }} / {{ matchCount }}</span>
                        <button class="doc-nav-btn" @click="prevMatch" title="Önceki">▲</button>
                        <button class="doc-nav-btn" @click="nextMatch" title="Sonraki">▼</button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Satır/Paragraf Bazlı Yorum Destekli Okuma Alanı -->
                <div class="ocr-lines-container">
                  <div v-for="line in parsedLines" :key="line.index" class="ocr-line-row">
                    <div class="ocr-line-main-group">
                      <div class="ocr-line-text" v-html="line.html"></div>
                      <button class="btn-comment-trigger" @click="toggleCommentInput(line.index)" title="Bu satıra yorum ekle">
                        💬
                      </button>
                    </div>
                    
                    <div v-if="activeCommentLineIndex === line.index" class="line-comment-input-area">
                      <input 
                        v-model="newCommentText" 
                        type="text" 
                        placeholder="Bu satır hakkında ne düşünüyorsunuz?" 
                        class="line-comment-input" 
                        @keydown.enter.prevent="addComment(line.index)"
                      />
                      <button class="btn-comment-add" @click="addComment(line.index)">Ekle</button>
                    </div>

                    <div v-if="line.comments && line.comments.length > 0" class="line-comments-list">
                      <div v-for="comment in line.comments" :key="comment.id" class="line-comment-box">
                        <span class="comment-icon">💬</span>
                        <p class="comment-text">{{ comment.text }}</p>
                        <button class="btn-comment-delete" @click="deleteComment(comment.id)" title="Yorumu sil">
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else class="modal-empty" style="border: 1px dashed var(--border); border-radius: 8px; padding: 1.5rem; text-align: center;">
                <p>Bu doküman için henüz çıkarılmış metin bulunmuyor.</p>
                <button 
                  class="action-link-btn" 
                  style="margin-top: 1rem; border: 1px solid var(--border); background: rgba(139, 92, 246, 0.08);"
                  @click="isEditing = true"
                >
                  ✏️ Metin Ekle
                </button>
              </div>

              <!-- 3. Orijinal Görsel / PDF Önizlemesi -->
              <div class="original-preview-section" style="border-top: 1px solid var(--border); padding-top: 1.5rem;">
                <h5 style="margin-bottom: 0.75rem; font-size: 0.85rem; font-weight: 700; color: #a78bfa;">🖼️ Orijinal Belge Önizlemesi</h5>
                <div class="preview-frame-wrapper" style="border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: #000; display: flex; justify-content: center; align-items: center; min-height: 300px; max-height: 500px;">
                  <iframe 
                    v-if="isPdf(selectedDoc.mimeType || selectedDoc.mime_type)" 
                    :src="'/uploads/' + getFileName(selectedDoc.filePath)" 
                    style="width: 100%; height: 500px; border: none;"
                  ></iframe>
                  <img 
                    v-else 
                    :src="'/uploads/' + getFileName(selectedDoc.filePath)" 
                    style="max-width: 100%; max-height: 500px; object-fit: contain;" 
                  />
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Güvenli Silme Onay Modalı (3 Saniye Kilitli) -->
    <Transition name="modal">
      <div v-if="deleteModalOpen" class="modal-overlay" @click.self="deleteModalOpen = false">
        <div class="modal modal--danger">
          <div class="modal-header">
            <h3 class="modal-title" style="color: #ef4444">{{ isBulkDelete ? 'Toplu Belge Sil' : 'Belgeyi Sil' }}</h3>
            <button class="modal-close" @click="deleteModalOpen = false">✕</button>
          </div>
          <div class="modal-body text-center" style="padding: 1.5rem; text-align: center">
            <p style="margin-bottom: 1.5rem; font-size: 0.95rem; line-height: 1.5">
              <span v-if="isBulkDelete">
                Seçilen <strong>{{ selectedIds.length }} adet</strong> belgeyi 
              </span>
              <span v-else>
                "<strong>{{ docToDelete?.originalName || docToDelete?.original_name }}</strong>" isimli belgeyi 
              </span>
              <span style="color: #ef4444; font-weight: 600">{{ isTrashView ? 'sistemden KALICI olarak silmek' : 'ÇÖP KUTUSUNA göndermek' }}</span> istediğinize emin misiniz?
            </p>
            <div class="modal-danger-actions" style="display: flex; gap: 0.75rem; justify-content: center">
              <button class="btn-cancel" @click="deleteModalOpen = false">Vazgeç</button>
              <button 
                class="btn-delete" 
                :disabled="deleteCountdown > 0 || isDeleting" 
                @click="confirmDelete"
              >
                {{ isDeleting ? 'Siliniyor...' : deleteCountdown > 0 ? `Evet, Sil (${deleteCountdown}s)` : 'Evet, Sil' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import DocumentEditor from './DocumentEditor.vue'

const documents = ref([])
const isLoading = ref(true)
const isPolling = ref(false)
const isSearchMode = ref(false)
const searchQuery = ref('')
const selectedDoc = ref(null)
const detailData = ref(null)
const isLoadingDetail = ref(false)
const isEditing = ref(false)

// AI Özeti bulucu
const aiSummary = computed(() => {
  const jobs = detailData.value?.jobs || [];
  const completedJob = jobs.find(j => j.jobStatus === 'COMPLETED' && j.resultSummary);
  return completedJob ? completedJob.resultSummary : 'Bu doküman için AI özeti bulunmamaktadır.';
})

function getFileName(filePath) {
  if (!filePath) return '';
  return filePath.split(/[/\\]/).pop();
}

function isPdf(mime) {
  return mime && mime.toLowerCase().includes('pdf');
}

function copyFilePath(path) {
  navigator.clipboard.writeText(path);
  alert('Dosya yolu kopyalandı: ' + path);
  if (selectedDoc.value) {
    trackAction('COPY_PATH', selectedDoc.value.id, selectedDoc.value.originalName || selectedDoc.value.original_name, `Belge dosya yolu kopyalandı: ${path}`);
  }
}

async function trackAction(action, documentId, documentName, details) {
  try {
    await fetch('/api/documents/audit-logs/click', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ action, documentId, documentName, details })
    })
  } catch (e) {
    console.error('[Track] Log gönderme hatası:', e.message);
  }
}

// SSE Canlı Güncelleme Dinleyici
let eventSource = null

// Rol kontrolü: Kullanıcı admin mi? (localStorage'dan veya jwt'den oku)
const isAdmin = computed(() => {
  const token = localStorage.getItem('token');
  if (!token) return false;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(window.atob(base64));
    return payload.role === 'admin' || payload.role === 'ciso';
  } catch (e) {
    return false;
  }
})

// Seçim State'leri
const selectedIds = ref([])
const isBulkDelete = ref(false)

// Çöp Kutusu ve Güvenli Silme State'leri
const isTrashView = ref(false)
const deleteModalOpen = ref(false)
const docToDelete = ref(null)
const deleteCountdown = ref(3)
let deleteInterval = null
const isDeleting = ref(false)

let pollInterval = null

// Doküman içi arama durumları
const docSearchQuery = ref('')
const matchCount = ref(0)
const activeMatchIndex = ref(0)
const highlightedOcrHtml = ref('')

// ============================================================
// Computed: Kesin ve Olası Sonuçlar
// ============================================================

const primaryResults = computed(() => {
  if (!isSearchMode.value) return documents.value
  return documents.value.filter(d => !d.isDimmed)
})

const dimmedResults = computed(() => {
  if (!isSearchMode.value) return []
  return documents.value.filter(d => d.isDimmed)
})

// ============================================================
// Doküman Listesini Çek
// ============================================================

async function fetchDocuments() {
  try {
    if (isTrashView.value) {
      await fetchTrashDocuments()
      return
    }
    const response = await fetch('/api/documents')
    if (response.ok) {
      const data = await response.json()
      documents.value = data.documents || []
    }
  } catch (error) {
    console.error('[DocumentList] Veri çekme hatası:', error)
  } finally {
    isLoading.value = false
  }
}

// Çöp kutusundaki silinmiş dökümanları çek
async function fetchTrashDocuments() {
  try {
    const response = await fetch('/api/documents/trash')
    if (response.ok) {
      const data = await response.json()
      documents.value = data.documents || []
    }
  } catch (error) {
    console.error('[DocumentList] Çöp kutusu verisi çekme hatası:', error)
  } finally {
    isLoading.value = false
  }
}

// Çöp kutusu görünümünü aç/kapat
function toggleTrashView() {
  isTrashView.value = !isTrashView.value
  isLoading.value = true
  documents.value = []
  
  if (isTrashView.value) {
    stopPolling()
    fetchTrashDocuments()
  } else {
    fetchDocuments()
    startPolling()
  }
}

// Seçim Metotları
const isAllSelected = computed(() => {
  const currentList = primaryResults.value;
  if (currentList.length === 0) return false;
  return currentList.every(d => selectedIds.value.includes(d.id));
})

function toggleSelectAll() {
  const currentList = primaryResults.value;
  if (isAllSelected.value) {
    // Mevcut sayfadaki veya filtrelenmiş listedeki ID'leri seçimden kaldır
    const currentIds = currentList.map(d => d.id);
    selectedIds.value = selectedIds.value.filter(id => !currentIds.includes(id));
  } else {
    // Mevcut listedeki seçilmeyen ID'leri seçime ekle
    currentList.forEach(d => {
      if (!selectedIds.value.includes(d.id)) {
        selectedIds.value.push(d.id);
      }
    });
  }
}

function toggleSelect(id) {
  const idx = selectedIds.value.indexOf(id);
  if (idx > -1) {
    selectedIds.value.splice(idx, 1);
  } else {
    selectedIds.value.push(id);
  }
}

// Toplu silme onay modalını tetikle
function triggerBulkDelete() {
  if (selectedIds.value.length === 0) return;
  isBulkDelete.value = true;
  docToDelete.value = null; // Tekli silme olmadığından temizle
  deleteCountdown.value = 3;
  deleteModalOpen.value = true;

  if (deleteInterval) clearInterval(deleteInterval);

  deleteInterval = setInterval(() => {
    if (deleteCountdown.value > 0) {
      deleteCountdown.value--;
    } else {
      clearInterval(deleteInterval);
      deleteInterval = null;
    }
  }, 1000);
}

// Silme onay modalını tetikle (3 saniye kilitle)
function triggerDelete(doc) {
  isBulkDelete.value = false;
  docToDelete.value = doc;
  deleteCountdown.value = 3;
  deleteModalOpen.value = true;
  
  if (deleteInterval) clearInterval(deleteInterval)
  
  deleteInterval = setInterval(() => {
    if (deleteCountdown.value > 0) {
      deleteCountdown.value--
    } else {
      clearInterval(deleteInterval)
      deleteInterval = null
    }
  }, 1000)
}

// Silme işlemini onayla (Soft veya Kalıcı - Toplu veya Tekli)
async function confirmDelete() {
  if (deleteCountdown.value > 0) return;
  
  isDeleting.value = true;
  const token = localStorage.getItem('token');
  
  try {
    if (isBulkDelete.value) {
      // TOPLU SİLME
      const response = await fetch('/api/documents/bulk', {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ids: selectedIds.value,
          force: isTrashView.value
        })
      });

      if (response.ok) {
        deleteModalOpen.value = false;
        selectedIds.value = [];
        if (isTrashView.value) {
          fetchTrashDocuments();
        } else {
          fetchDocuments();
        }
      }
    } else {
      // TEKLİ SİLME
      if (!docToDelete.value) return;
      const id = docToDelete.value.id;
      let url = `/api/documents/${id}`;
      let method = 'DELETE';
      
      if (isTrashView.value) {
        url = `/api/documents/${id}/force`;
      }
      
      const response = await fetch(url, { 
        method,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        deleteModalOpen.value = false;
        docToDelete.value = null;
        selectedIds.value = selectedIds.value.filter(selId => selId !== id);
        
        if (isTrashView.value) {
          fetchTrashDocuments();
        } else {
          fetchDocuments();
        }
      }
    }
  } catch (error) {
    console.error('[DocumentList] Silme hatası:', error);
  } finally {
    isDeleting.value = false;
  }
}

// Dokümanı Çöp Kutusundan Kurtar (Restore)
async function restoreDocument(doc) {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/documents/${doc.id}/restore`, { 
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    if (response.ok) {
      fetchTrashDocuments()
    }
  } catch (error) {
    console.error('[DocumentList] Geri yükleme hatası:', error)
  }
}

// ============================================================
// Polling (5 saniyede bir güncelleme)
// ============================================================

function startPolling() {
  isPolling.value = true
  pollInterval = setInterval(() => {
    fetchDocuments()
  }, 5000)
  console.log('[DocumentList] Polling başlatıldı (5s aralık)')
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  isPolling.value = false
}

// ============================================================
// Doküman Detay Modalı ve İçerik Arama Mantığı
// ============================================================

function getHighlightedHtml(text, query) {
  if (!text) return '';

  if (!query || query.trim().length === 0) {
    matchCount.value = 0;
    activeMatchIndex.value = 0;
    return text;
  }

  const term = query.trim();
  const escapedTerm = term.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedTerm})(?![^<>]*>)`, 'gi');
  
  let matchId = 0;
  const highlighted = text.replace(regex, (match) => {
    const id = matchId++;
    return `<span class="doc-match" data-match-index="${id}">${match}</span>`;
  });

  matchCount.value = matchId;
  return highlighted;
}

function updateActiveMatch() {
  nextTick(() => {
    const container = document.querySelector('.ocr-text');
    if (!container) return;

    const matches = container.querySelectorAll('.doc-match');
    matches.forEach((el, idx) => {
      if (idx === activeMatchIndex.value) {
        el.classList.add('doc-match--active');
        
        // Sadece container elementini kaydır
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        container.scrollTop = container.scrollTop + (elRect.top - containerRect.top) - (containerRect.height / 2) + (elRect.height / 2);
      } else {
        el.classList.remove('doc-match--active');
      }
    });
  });
}

function onDocSearch() {
  activeMatchIndex.value = 0;
  updateHighlightHtml();
}

function nextMatch() {
  if (matchCount.value === 0) return;
  activeMatchIndex.value = (activeMatchIndex.value + 1) % matchCount.value;
  updateActiveMatch();
}

function prevMatch() {
  if (matchCount.value === 0) return;
  activeMatchIndex.value = (activeMatchIndex.value - 1 + matchCount.value) % matchCount.value;
  updateActiveMatch();
}

function updateHighlightHtml() {
  const text = detailData.value?.metadata?.extracted_text || detailData.value?.metadata?.extractedText || '';
  highlightedOcrHtml.value = getHighlightedHtml(text, docSearchQuery.value);
  updateActiveMatch();
}

watch([docSearchQuery, detailData], () => {
  updateHighlightHtml();
});

// Yorumlama ve Paragraf Bazlı Ayrıştırma Mantığı
const activeCommentLineIndex = ref(-1);
const newCommentText = ref('');

const parsedLines = computed(() => {
  const htmlText = highlightedOcrHtml.value || '';
  if (!htmlText) return [];
  
  if (!htmlText.trim().startsWith('<p')) {
    return htmlText.split('\n').map((line, idx) => ({
      index: idx,
      html: `<p>${line}</p>`,
      comments: getCommentsForLine(idx)
    }));
  }
  
  const regex = /<p[^>]*>.*?<\/p>/gi;
  const matches = htmlText.match(regex) || [];
  
  return matches.map((pHTML, idx) => ({
    index: idx,
    html: pHTML,
    comments: getCommentsForLine(idx)
  }));
});

function getCommentsForLine(lineIdx) {
  const allComments = detailData.value?.metadata?.comments || [];
  return allComments.filter(c => c.lineIndex === lineIdx);
}

function toggleCommentInput(lineIdx) {
  if (activeCommentLineIndex.value === lineIdx) {
    activeCommentLineIndex.value = -1;
    newCommentText.value = '';
  } else {
    activeCommentLineIndex.value = lineIdx;
    newCommentText.value = '';
  }
}

async function addComment(lineIdx) {
  if (!newCommentText.value.trim() || !selectedDoc.value) return;
  
  const allComments = [...(detailData.value?.metadata?.comments || [])];
  const newComment = {
    id: Math.random().toString(36).substring(2, 11),
    lineIndex: lineIdx,
    text: newCommentText.value.trim(),
    createdAt: new Date().toISOString()
  };
  
  allComments.push(newComment);
  
  try {
    const response = await fetch(`/api/documents/${selectedDoc.value.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        comments: allComments
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      detailData.value = data.document;
      selectedDoc.value = data.document;
      const idx = documents.value.findIndex(d => d.id === data.document.id);
      if (idx !== -1) {
        documents.value[idx] = data.document;
      }
      activeCommentLineIndex.value = -1;
      newCommentText.value = '';
    }
  } catch (error) {
    console.error('[DocumentList] Yorum ekleme hatası:', error);
  }
}

async function deleteComment(commentId) {
  if (!selectedDoc.value) return;
  
  const allComments = (detailData.value?.metadata?.comments || []).filter(c => c.id !== commentId);
  
  try {
    const response = await fetch(`/api/documents/${selectedDoc.value.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        comments: allComments
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      detailData.value = data.document;
      selectedDoc.value = data.document;
      const idx = documents.value.findIndex(d => d.id === data.document.id);
      if (idx !== -1) {
        documents.value[idx] = data.document;
      }
    }
  } catch (error) {
    console.error('[DocumentList] Yorum silme hatası:', error);
  }
}

async function openDetail(doc) {
  selectedDoc.value = doc
  isLoadingDetail.value = true
  detailData.value = null
  isEditing.value = false
  docSearchQuery.value = searchQuery.value || '' // Arama sorgusuyla başlat
  activeMatchIndex.value = 0

  trackAction('PREVIEW', doc.id, doc.originalName || doc.original_name, 'Belge detayları, AI özeti ve OCR metni görüntülendi.');

  try {
    const response = await fetch(`/api/documents/${doc.id}`)
    if (response.ok) {
      const data = await response.json()
      detailData.value = data.document || data
      console.log('[DocumentList] Detay yüklendi:', doc.id)
    }
  } catch (error) {
    console.error('[DocumentList] Detay yükleme hatası:', error)
  } finally {
    isLoadingDetail.value = false
  }
}

function closeDetail() {
  selectedDoc.value = null
  detailData.value = null
  isEditing.value = false
  docSearchQuery.value = ''
  matchCount.value = 0
  activeMatchIndex.value = 0
  highlightedOcrHtml.value = ''
}

function handleEditorSave(updatedDoc) {
  if (detailData.value) {
    detailData.value = updatedDoc;
  }
  if (selectedDoc.value) {
    selectedDoc.value = updatedDoc;
  }
  const index = documents.value.findIndex(d => d.id === updatedDoc.id);
  if (index !== -1) {
    documents.value[index] = updatedDoc;
  }
  isEditing.value = false;
}

function handleEditorCancel() {
  isEditing.value = false;
}

// ============================================================
// Dışarıdan tetiklenebilir yenile fonksiyonu
// ============================================================

function refresh() {
  if (!isSearchMode.value) {
    fetchDocuments()
  }
}

// ============================================================
// Arama Fonksiyonları
// ============================================================

function setLoading(state) {
  isLoading.value = state
  if (state) documents.value = []
}

function setSearchResults(results, term) {
  stopPolling() // Arama modunda polling'i durdur
  documents.value = results
  isSearchMode.value = true
  searchQuery.value = term
  isLoading.value = false
}

function clearSearch() {
  isSearchMode.value = false
  searchQuery.value = ''
  isLoading.value = true
  fetchDocuments()
  startPolling()
}

defineExpose({ refresh, setLoading, setSearchResults, clearSearch })

// ============================================================
// Yardımcı Fonksiyonlar
// ============================================================

function getFileIcon(mimeType) {
  if (mimeType === 'application/pdf') return '📕'
  if (mimeType === 'image/png') return '🖼️'
  if (mimeType === 'image/jpeg') return '📷'
  return '📄'
}

function getTypeLabel(mimeType) {
  if (mimeType === 'application/pdf') return 'PDF'
  if (mimeType === 'image/png') return 'PNG'
  if (mimeType === 'image/jpeg') return 'JPG'
  return 'Diğer'
}

function getStatusLabel(status) {
  const labels = {
    PENDING: 'Beklemede',
    PROCESSING: 'İşleniyor',
    COMPLETED: 'Tamamlandı',
    FAILED: 'Başarısız',
  }
  return labels[status] || status
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getCleanCategoryClass(cat) {
  if (!cat) return 'diger';
  const c = cat.toLowerCase();
  if (c === 'uncategorized' || c === 'undefined' || c === 'diger') return 'diger';
  return c;
}

function getCleanCategoryLabel(cat) {
  if (!cat || cat === 'uncategorized' || cat === 'undefined' || cat === 'Diger') return 'Diğer';
  return cat;
}

// ============================================================
// Yaşam Döngüsü (Lifecycle)
// ============================================================

// SSE Gerçek Zamanlı Güncelleme Bağlantısı
function startSseConnection() {
  if (typeof window === 'undefined') return;
  
  // Varsa eski bağlantıyı temizle
  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource('/api/events');

  eventSource.addEventListener('document_updated', (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('[SSE_EVENT] Canlı durum güncellemesi alındı:', data);
      
      const index = documents.value.findIndex(d => d.id === data.id);
      if (index !== -1) {
        // Durumu ve varsa güncel nesneyi güncelle
        documents.value[index].status = data.status;
        if (data.category) {
          documents.value[index].category = data.category;
        }
        if (data.document) {
          // Bütün veriyi güncelle
          documents.value[index] = { ...documents.value[index], ...data.document };
        }
      }
    } catch (err) {
      console.error('[SSE_PARSE_ERR] Gelen veri çözülemedi:', err);
    }
  });

  eventSource.onerror = (err) => {
    console.warn('[SSE_ERR] SSE bağlantı hatası oluştu, yeniden bağlanmaya çalışılacak:', err);
    eventSource.close();
    // 5 saniye sonra yeniden bağlanmayı dene
    setTimeout(startSseConnection, 5000);
  };
}

onMounted(() => {
  fetchDocuments()
  startPolling()
  startSseConnection()
})

onUnmounted(() => {
  stopPolling()
  if (eventSource) {
    eventSource.close()
  }
})
</script>

<style scoped>
.doc-list {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.search-badge {
  font-size: 0.78rem;
  color: var(--accent);
  background: var(--accent-glow);
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  border: 1px solid rgba(56, 189, 248, 0.3);
}
.search-badge strong {
  color: #fff;
}

.doc-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border);
}

.doc-list-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.doc-list-title svg {
  color: var(--accent);
  opacity: 0.8;
}

.doc-header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.polling-indicator {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  font-weight: 500;
  color: #22c55e;
}

.polling-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
  animation: pulse-poll 1.5s infinite ease-in-out;
}

@keyframes pulse-poll {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.doc-count {
  font-size: 0.78rem;
  color: var(--text-secondary);
  background: var(--bg-primary);
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  border: 1px solid var(--border);
}

/* Loading */
.doc-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  color: var(--text-secondary);
  font-size: 0.88rem;
}

.spinner-sm {
  width: 24px;
  height: 24px;
  border: 2.5px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner-xs {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Tablo */
/* Toplu İşlem Çubuğu */
.bulk-action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 8px;
  padding: 0.75rem 1.25rem;
  margin: 0.75rem 1.5rem;
  box-shadow: 0 0 15px rgba(239, 68, 68, 0.05);
  animation: pulse-glow-red 2s infinite ease-in-out;
}

@keyframes pulse-glow-red {
  0%, 100% { border-color: rgba(239, 68, 68, 0.25); }
  50% { border-color: rgba(239, 68, 68, 0.55); }
}

.bulk-count {
  font-size: 0.82rem;
  font-weight: 600;
  color: #f87171;
}

.bulk-delete-btn {
  font-size: 0.76rem !important;
  font-weight: 700 !important;
  padding: 0.4rem 0.85rem !important;
}

.doc-row--selected {
  background: rgba(239, 68, 68, 0.03) !important;
}

.doc-row--selected:hover {
  background: rgba(239, 68, 68, 0.06) !important;
}

.doc-table-wrap {
  overflow-x: auto;
}

.doc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.doc-table thead {
  background: rgba(15, 23, 42, 0.5);
}

.doc-table th {
  text-align: left;
  padding: 0.7rem 1.25rem;
  font-weight: 500;
  color: var(--text-secondary);
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.doc-row {
  border-bottom: 1px solid var(--border);
  transition: background 0.15s;
}

.doc-row:last-child {
  border-bottom: none;
}

.doc-row:hover {
  background: rgba(56, 189, 248, 0.03);
}

.doc-row--dimmed {
  opacity: 0.5;
}

.doc-row--dimmed:hover {
  opacity: 0.72;
}

/* Olası Eşleşmeler Ayırıcı */
.dimmed-separator-row {
  border: none !important;
}

.dimmed-separator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 0;
}

.dimmed-separator-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--border), transparent);
}

.dimmed-separator-text {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-secondary);
  opacity: 0.7;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.doc-row-highlight {
  border-bottom: 1px solid var(--border);
  background: rgba(15, 23, 42, 0.3);
}

.search-highlight {
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.6;
  padding: 0 1.25rem 1rem 3.5rem;
}

.search-highlight :deep(mark) {
  background: linear-gradient(120deg, rgba(250, 204, 21, 0.4) 0%, rgba(74, 222, 128, 0.35) 100%);
  color: #fef9c3;
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(250, 204, 21, 0.15);
}

.doc-table td {
  padding: 0.75rem 1.25rem;
  white-space: nowrap;
}

.doc-name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  color: var(--text-primary);
  max-width: 380px;
  overflow: hidden;
}

.doc-name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

/* Eşleşme Konumu Badge */
.match-badge {
  flex-shrink: 0;
  font-size: 0.62rem;
  font-weight: 600;
  padding: 0.15rem 0.45rem;
  border-radius: 6px;
  white-space: nowrap;
  letter-spacing: 0.3px;
}

.match--filename {
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
  border: 1px solid rgba(74, 222, 128, 0.25);
}

.match--content {
  background: rgba(56, 189, 248, 0.1);
  color: #7dd3fc;
  border: 1px solid rgba(56, 189, 248, 0.2);
}

.doc-date {
  color: var(--text-secondary);
  font-size: 0.82rem;
}

/* Tür Badge */
.type-badge {
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  border: 1px solid var(--border);
  letter-spacing: 0.5px;
}

/* Kategori Badgeleri */
.category-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
  border: 1px solid transparent;
  white-space: nowrap;
}

.cat--fatura {
  background: rgba(234, 179, 8, 0.12);
  color: #facc15;
  border-color: rgba(234, 179, 8, 0.25);
}

.cat--bordro {
  background: rgba(34, 197, 94, 0.12);
  color: #4ade80;
  border-color: rgba(34, 197, 94, 0.25);
}

.cat--sozlesme {
  background: rgba(59, 130, 246, 0.12);
  color: #60a5fa;
  border-color: rgba(59, 130, 246, 0.25);
}

.cat--rapor {
  background: rgba(249, 115, 22, 0.12);
  color: #f97316;
  border-color: rgba(249, 115, 22, 0.25);
}

.cat--dilekce {
  background: rgba(236, 72, 153, 0.12);
  color: #f472b6;
  border-color: rgba(236, 72, 153, 0.25);
}

.cat--diger {
  background: var(--bg-primary);
  color: var(--text-secondary);
  border-color: var(--border);
}

/* Durum Badge */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  font-weight: 500;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status--pending {
  background: rgba(234, 179, 8, 0.1);
  color: #facc15;
  border: 1px solid rgba(234, 179, 8, 0.25);
}
.status--pending .status-dot { background: #facc15; }

.status--processing {
  background: rgba(56, 189, 248, 0.1);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.25);
}
.status--processing .status-dot {
  background: #38bdf8;
  animation: pulse-poll 1.2s infinite ease-in-out;
}

.status--completed {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.25);
}
.status--completed .status-dot { background: #22c55e; }

.status--failed {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.25);
}
.status--failed .status-dot { background: #ef4444; }

/* Action Button */
.doc-actions {
  text-align: center;
}

.action-btn {
  background: var(--accent-glow);
  color: var(--accent);
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 8px;
  padding: 0.35rem 0.5rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  transition: all 0.2s;
}

.action-btn:hover {
  background: rgba(56, 189, 248, 0.25);
  border-color: var(--accent);
  transform: scale(1.05);
}

.action-hint {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Boş Durum */
.doc-empty {
  padding: 3rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.9rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.doc-empty-sub {
  font-size: 0.78rem;
  opacity: 0.6;
  margin-top: 0.25rem;
}

/* ============================================================
   MODAL
   ============================================================ */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
  padding: 2rem;
}

.modal {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  width: 100%;
  max-width: 680px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border);
}

.modal-title-wrap {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.modal-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.modal-close {
  background: none;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.35rem;
  display: flex;
  align-items: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.modal-close:hover {
  border-color: var(--text-primary);
  color: var(--text-primary);
}

.modal-meta {
  display: flex;
  gap: 1.5rem;
  padding: 0.85rem 1.5rem;
  border-bottom: 1px solid var(--border);
  background: rgba(15, 23, 42, 0.4);
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.meta-label {
  font-size: 0.68rem;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.meta-value {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.modal-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.modal-empty {
  text-align: center;
  color: var(--text-secondary);
  padding: 2rem;
  font-size: 0.88rem;
}

.ocr-output {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ocr-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.ocr-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.76rem;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.ocr-label svg {
  color: var(--accent);
}

/* Doküman içi arama çubuğu */
.doc-search-box {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.25rem 0.55rem;
  max-width: 280px;
  transition: border-color 0.2s;
}

.doc-search-box:focus-within {
  border-color: var(--accent);
}

.doc-search-input {
  background: none;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 0.75rem;
  font-family: inherit;
  width: 130px;
}

.doc-search-input::placeholder {
  color: var(--text-secondary);
  opacity: 0.5;
}

.doc-search-nav {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  border-left: 1px solid var(--border);
  padding-left: 0.35rem;
}

.doc-search-count {
  font-size: 0.68rem;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.doc-nav-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.1rem 0.2rem;
  font-size: 0.65rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s;
}

.doc-nav-btn:hover {
  color: var(--accent);
}

.ocr-text {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1.25rem;
  font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace;
  font-size: 0.82rem;
  line-height: 1.7;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 400px;
  overflow-y: auto;
  position: relative;
}

/* Match Highlights (Fosforlu Kalem) */
.ocr-text :deep(.doc-match) {
  background: rgba(250, 204, 21, 0.35);
  color: #fff;
  border-radius: 2px;
  transition: all 0.15s;
  padding: 0.05rem 0.1rem;
}

.ocr-text :deep(.doc-match--active) {
  background: linear-gradient(120deg, rgba(34, 197, 94, 0.75) 0%, rgba(74, 222, 128, 0.7) 100%) !important;
  color: #ffffff !important;
  box-shadow: 0 0 10px rgba(74, 222, 128, 0.6), 0 2px 4px rgba(0, 0, 0, 0.2);
  font-weight: 600;
  transform: scale(1.03);
  display: inline-block;
}

/* Modal Transition */
.modal-enter-active {
  animation: modal-in 0.3s ease;
}
.modal-leave-active {
  animation: modal-in 0.2s ease reverse;
}

@keyframes modal-in {
  from { opacity: 0; transform: scale(0.95) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

/* Çöp Kutusu Toggle Buton Stilleri */
.trash-toggle-btn {
  background: rgba(15, 23, 42, 0.4);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.4rem 0.8rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  margin-right: 0.5rem;
}

.trash-toggle-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.4);
  color: #ef4444;
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.15);
}

.trash-toggle-btn.trash-active {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
  color: #fff;
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.4);
  animation: neon-pulse-danger 2s infinite alternate;
}

.trash-icon {
  transition: transform 0.2s;
}

.trash-toggle-btn:hover .trash-icon {
  transform: rotate(-10deg) scale(1.1);
}

/* Orijinal Belgeyi Aç Bağlantısı Butonu */
.action-link-btn {
  display: inline-flex;
  align-items: center;
  background: rgba(56, 189, 248, 0.1);
  color: var(--accent);
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 8px;
  padding: 0.35rem 0.65rem;
  font-size: 0.75rem;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s;
}

.action-link-btn:hover {
  background: rgba(56, 189, 248, 0.25);
  border-color: var(--accent);
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.25);
}

/* Modal Tehlike / Silme Tasarımları */
.modal--danger {
  max-width: 420px;
  border-color: rgba(239, 68, 68, 0.4);
  box-shadow: 0 16px 64px rgba(239, 68, 68, 0.15);
}

.btn-cancel {
  background: rgba(15, 23, 42, 0.5);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.btn-cancel:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}

.btn-delete {
  background: #ef4444;
  color: #fff;
  border: 1px solid #ef4444;
  border-radius: 8px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.btn-delete:hover:not(:disabled) {
  background: #dc2626;
  box-shadow: 0 0 15px rgba(239, 68, 68, 0.45);
}

.btn-delete:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.1);
  color: rgba(255, 255, 255, 0.5);
}

/* Başarı (Geri Yükleme) Butonu */
.action-btn--success {
  background: rgba(34, 197, 94, 0.1) !important;
  color: #22c55e !important;
  border-color: rgba(34, 197, 94, 0.25) !important;
}

.action-btn--success:hover {
  background: rgba(34, 197, 94, 0.25) !important;
  border-color: #22c55e !important;
  box-shadow: 0 0 10px rgba(34, 197, 94, 0.25);
}

.action-btn--danger {
  background: rgba(239, 68, 68, 0.1) !important;
  color: #ef4444 !important;
  border-color: rgba(239, 68, 68, 0.25) !important;
  margin-left: 0.35rem;
}

.action-btn--danger:hover {
  background: rgba(239, 68, 68, 0.25) !important;
  border-color: #ef4444 !important;
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.25);
}

/* Neon Pulse Efektleri */
@keyframes neon-pulse-danger {
  0% { box-shadow: 0 0 8px rgba(239, 68, 68, 0.3); }
  100% { box-shadow: 0 0 16px rgba(239, 68, 68, 0.6); }
}

/* Satır Bazlı Yorumlama Stilleri */
.ocr-lines-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1.25rem;
  max-height: 450px;
  overflow-y: auto;
}

.ocr-line-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  padding-bottom: 0.5rem;
  transition: background 0.2s ease;
}

.ocr-line-row:hover {
  background: rgba(255, 255, 255, 0.01);
}

.ocr-line-main-group {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.ocr-line-text {
  font-size: 0.88rem;
  line-height: 1.6;
  color: var(--text-primary);
  flex-grow: 1;
  word-break: break-word;
}

.ocr-line-text p {
  margin: 0;
}

.btn-comment-trigger {
  background: transparent;
  border: none;
  font-size: 0.95rem;
  cursor: pointer;
  opacity: 0.3;
  transition: opacity 0.2s ease, transform 0.2s ease;
  padding: 2px 6px;
  border-radius: 4px;
}

.ocr-line-row:hover .btn-comment-trigger,
.btn-comment-trigger:hover {
  opacity: 1;
  transform: scale(1.15);
  background: rgba(139, 92, 246, 0.1);
}

/* Yorum Ekleme Alanı */
.line-comment-input-area {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;
  background: rgba(30, 41, 59, 0.4);
  padding: 0.4rem;
  border-radius: 6px;
  border: 1px solid rgba(139, 92, 246, 0.2);
}

.line-comment-input {
  flex-grow: 1;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 0.78rem;
  outline: none;
}

.btn-comment-add {
  background: var(--accent);
  color: #fff;
  border: none;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.25rem 0.65rem;
  border-radius: 4px;
  cursor: pointer;
}

.btn-comment-add:hover {
  background: var(--accent-hover);
}

/* Yorum Listesi */
.line-comments-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-top: 0.25rem;
  padding-left: 0.75rem;
}

.line-comment-box {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  background: rgba(139, 92, 246, 0.05);
  border: 1px solid rgba(139, 92, 246, 0.15);
  border-radius: 6px;
  padding: 0.35rem 0.6rem;
  font-size: 0.76rem;
  position: relative;
}

.comment-icon {
  font-size: 0.7rem;
  opacity: 0.7;
}

.comment-text {
  margin: 0;
  color: var(--text-primary);
  flex-grow: 1;
  opacity: 0.9;
}

.btn-comment-delete {
  background: transparent;
  border: none;
  cursor: pointer;
  opacity: 0.4;
  font-size: 0.7rem;
  transition: opacity 0.2s ease, transform 0.2s ease;
  padding: 0 4px;
}

.btn-comment-delete:hover {
  opacity: 1;
  transform: scale(1.1);
}
</style>
