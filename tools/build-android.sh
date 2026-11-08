#!/bin/bash
# CLI Android build (debug APK, arm64-v8a). Close this project's editor first.
cd "$(dirname "$0")/.."
export JAVA_HOME=/Users/ctop/Library/Java/JavaVirtualMachines/jbr-17.0.14/Contents/Home
export ANDROID_HOME=/Users/ctop/Library/Android/sdk
/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator --project "$PWD" --build "configPath=$PWD/tools/build/android.json" > /tmp/cocos-android.log 2>&1
echo "cocos build exit $?" | tee -a /tmp/cocos-android.log
# Cocos CLI only generates build/android/proj; compile the APK with Gradle
(cd build/android/proj && ./gradlew --no-daemon assembleDebug) >> /tmp/cocos-android.log 2>&1
echo "gradle exit $?" | tee -a /tmp/cocos-android.log
APK=$(find build/android/proj -name "*.apk" -path "*debug*" | head -1)
echo "apk: $APK" | tee -a /tmp/cocos-android.log
if [ -n "$APK" ]; then mkdir -p ../_deliverables && cp "$APK" ../_deliverables/ember-cocos.apk && ls -la ../_deliverables/ember-cocos.apk | tee -a /tmp/cocos-android.log; fi
