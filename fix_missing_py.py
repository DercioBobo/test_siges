import os

doctype_dir = r"c:\Users\DBobo\PhpstormProjects\test_siges\escola\escola\doctype"

for dt_folder in os.listdir(doctype_dir):
    dt_path = os.path.join(doctype_dir, dt_folder)
    if os.path.isdir(dt_path):
        init_file = os.path.join(dt_path, "__init__.py")
        if not os.path.exists(init_file):
            with open(init_file, "w", encoding="utf-8") as f:
                f.write("# -*- coding: utf-8 -*-\n")
                
        py_file = os.path.join(dt_path, f"{dt_folder}.py")
        if not os.path.exists(py_file):
            class_name = "".join(x.capitalize() for x in dt_folder.split("_"))
            content = f"""# -*- coding: utf-8 -*-
# Copyright (c) 2024, EntreTech and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class {class_name}(Document):
    pass
"""
            with open(py_file, "w", encoding="utf-8") as f:
                f.write(content)
print("Done.")
