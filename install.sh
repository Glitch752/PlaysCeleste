curl https://dev.azure.com/EverestAPI/Olympus/_apis/build/builds/4923/artifacts?artifactName=linux.main&api-version=5.0&%24format=zip --output olympus.zip
unzip olympus.zip
rm olympus.zip

cd linux.main
unzip dist.zip
rm dist.zip

cd ..
mv linux.main/ olympus/

echo "\n\nDownloaded olympus. You'll need to go into the UI and set up the Celeste location and install Everest (testing done on version 5635)."

olympus/olympus

# TODO: Manual Everest installation without Olympus GUI