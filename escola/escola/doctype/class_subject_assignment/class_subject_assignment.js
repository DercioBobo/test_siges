// Copyright (c) 2024, EntreTech and contributors
// For license information, please see license.txt

frappe.ui.form.on("Class Subject Assignment", {
	refresh(frm) {
	},

	fetch_subjects(frm) {
		if (!frm.doc.school_class) {
			frappe.msgprint(__('Por favor, seleccione primeiro a Classe.'));
			return;
		}
		
        frappe.call({
            method: "escola.escola.doctype.class_subject_assignment.class_subject_assignment.get_curriculum_subjects",
            args: {
                school_class: frm.doc.school_class,
                academic_year: frm.doc.academic_year
            },
            callback: function(r) {
                if (r.message && r.message.length > 0) {
                    frm.clear_table("subjects");
                    r.message.forEach(row => {
                        let child = frm.add_child("subjects");
                        child.subject = row.subject;
                        child.teacher = row.teacher;
                    });
                    frm.refresh_field("subjects");
                    frappe.msgprint(__('Disciplinas carregadas com sucesso.'));
                } else {
                    frappe.msgprint(__('Nenhuma grelha curricular encontrada para esta classe. Verifique o Curr\u00edculo da Classe.'));
                }
            }
        });
	}
});

frappe.ui.form.on("Class Subject Assignment Line", {
    subject: function(frm, cdt, cdn) {
        let row = frappe.get_doc(cdt, cdn);
        if (row.subject && !row.teacher && frm.doc.school_class) {
            frappe.db.get_value("Subject", row.subject, "is_specialized_subject", function(r) {
                if (r && !r.is_specialized_subject) {
                    frappe.db.get_value("School Class", frm.doc.school_class, "default_teacher", function(res) {
                        if (res && res.default_teacher) {
                            frappe.model.set_value(cdt, cdn, "teacher", res.default_teacher);
                        }
                    });
                }
            });
        }
    }
});
