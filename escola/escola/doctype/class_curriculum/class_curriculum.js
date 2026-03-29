frappe.ui.form.on("Class Curriculum", {
    refresh(frm) {
        frm.set_query("school_class", () => ({ filters: { is_active: 1 } }));
        frm.set_query("academic_year", () => ({}));

        if (!frm.doc.__islocal) {
            _show_summary(frm);
        }
    },

    subject_lines_add(frm) { _show_summary(frm); },
    subject_lines_remove(frm) { _show_summary(frm); },
});

frappe.ui.form.on("Class Curriculum Line", {
    subject(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        if (!row.subject) return;

        // Auto-fill teacher from Subject.default_teacher if the line has no teacher yet
        frappe.db.get_value("Subject", row.subject, "default_teacher", (r) => {
            if (r && r.default_teacher && !row.teacher) {
                frappe.model.set_value(cdt, cdn, "teacher", r.default_teacher);
            }
        });
    },
});

function _show_summary(frm) {
    const count = (frm.doc.subject_lines || []).length;
    if (count > 0) {
        frm.dashboard.set_headline(
            __("{0} disciplina(s) na grelha", [count])
        );
    }
}
