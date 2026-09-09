import sys
import os
import platform
import shutil

print("=== Python & OS Details ===")
print(f"Python Version: {sys.version}")
print(f"Platform: {platform.platform()}")
print(f"Processor: {platform.processor()}")
print(f"Architecture: {platform.architecture()}")

# Hardware info via psutil or system commands if available
try:
    import psutil
    vm = psutil.virtual_memory()
    print(f"Total RAM: {vm.total / (1024**3):.2f} GB, Available RAM: {vm.available / (1024**3):.2f} GB")
    print(f"CPU Physical Cores: {psutil.cpu_count(logical=False)}, Logical Cores: {psutil.cpu_count(logical=True)}")
except ImportError:
    print("psutil: NOT INSTALLED")

# Check CUDA / GPU
print("\n=== GPU / CUDA Availability ===")
try:
    import torch
    print(f"PyTorch: {torch.__version__}, CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"Device: {torch.cuda.get_device_name(0)}, Device Count: {torch.cuda.device_count()}")
except ImportError:
    print("PyTorch: NOT INSTALLED")

try:
    import tensorflow as tf
    print(f"TensorFlow: {tf.__version__}, GPUs: {tf.config.list_physical_devices('GPU')}")
except ImportError:
    print("TensorFlow: NOT INSTALLED")

# Check external CLIs
print("\n=== External GIS / Point Cloud CLIs ===")
for cli in ['pdal', 'gdalinfo', 'ogrinfo', 'cloudcompare', 'CloudCompare', 'lasinfo', 'nvidia-smi']:
    path = shutil.which(cli)
    print(f"{cli}: {'FOUND at ' + path if path else 'NOT FOUND on PATH'}")

# Check Python Packages
print("\n=== Python Packages Inspection ===")
check_list = [
    'numpy', 'scipy', 'pandas', 'sklearn',
    'torch', 'torchvision', 'tensorflow', 'cv2', 'open3d',
    'laspy', 'pdal', 'rasterio', 'geopandas', 'shapely',
    'pyproj', 'pyntcloud', 'fastapi', 'sqlalchemy', 'geoalchemy2',
    'psycopg', 'pydantic'
]
for pkg in check_list:
    try:
        mod = __import__(pkg)
        ver = getattr(mod, '__version__', 'Installed (no __version__)')
        print(f"{pkg}: INSTALLED ({ver})")
    except ImportError:
        print(f"{pkg}: NOT INSTALLED")
