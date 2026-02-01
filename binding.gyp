{
  "targets": [
    {
      "target_name": "aegis_security",
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "conditions": [
        ['OS=="win"', {
          "sources": [ "src/native/security_win.cpp" ],
          "msvs_settings": {
            "VCLinkerTool": {
              "AdditionalDependencies": [ "crypt32.lib" ]
            }
          }
        }, {
           "sources": [ "src/native/security_stub.cpp" ]
        }]
      ]
    }
  ]
}
