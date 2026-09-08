#Windows machine only setup 

py -3.12 -m venv .venv1
.\.venv1\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt

Write-Host "Move2Unlock setup complete!"

#To run its ""./setup.ps1"