; Applied to both the installer and the uninstaller by electron-builder.
!ifndef BUILD_UNINSTALLER
  ; Compress installer UI/plugins with LZMA; the embedded 7z app payload stays as-is.
  ; Keep electron-builder's intermediate uninstaller bootstrap on its expected zlib codec.
  SetCompressor /FINAL lzma
!endif

!macro customHeader
  ; Let Windows render text and controls at the system DPI instead of bitmap scaling.
  ; NSIS MUI/nsDialogs pages are not fully per-monitor-DPI aware, so keep system awareness.
  ManifestDPIAware true
  SetFont "Microsoft YaHei UI" 9
!macroend
