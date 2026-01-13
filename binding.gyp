{
  "targets": [
    {
      "target_name": "aegis_security",
      "sources": [ "src/native/security_win.cpp" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "msvs_settings": {
        "VCLinkerTool": {
          "AdditionalDependencies": [ "crypt32.lib" ]
        }
      }
    }
  ]
}
