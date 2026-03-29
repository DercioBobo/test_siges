import frappe
from frappe import _
from frappe.model.document import Document


class ClassSubjectAssignment(Document):
    def validate(self):
        self._validate_unique_assignment()
        self._validate_no_duplicate_subjects_in_table()
        self._validate_teachers_active()

    def _validate_unique_assignment(self):
        if not self.is_active:
            return
        
        filters = {
            "school_class": self.school_class,
            "academic_year": self.academic_year,
            "is_active": 1,
            "name": ("!=", self.name)
        }
        existing = frappe.db.get_value("Class Subject Assignment", filters, "name")
        if existing:
            frappe.throw(
                _("J\u00e1 existe uma Atribui\u00e7\u00e3o Activa para a Classe <b>{0}</b> no Ano Lectivo <b>{1}</b>: <b>{2}</b>.").format(
                    self.school_class, self.academic_year, existing
                ),
                title=_("Atribui\u00e7\u00e3o Duplicada")
            )

    def _validate_no_duplicate_subjects_in_table(self):
        seen = set()
        for row in self.get("subjects", []):
            if row.subject:
                if row.subject in seen:
                    frappe.throw(
                        _("A disciplina <b>{0}</b> aparece mais que uma vez na tabela.").format(row.subject),
                        title=_("Disciplina Duplicada")
                    )
                seen.add(row.subject)

    def _validate_teachers_active(self):
        teacher_names = [row.teacher for row in self.get("subjects", []) if row.teacher]
        if not teacher_names:
            return
            
        inactive_teachers = frappe.get_all("Teacher", filters={"name": ("in", teacher_names), "is_active": 0}, pluck="name")
        if inactive_teachers:
            frappe.throw(
                _("O(s) seguinte(s) professor(es) n\u00e3o est\u00e1(\u00e3o) activo(s): <b>{0}</b>").format(", ".join(inactive_teachers)),
                title=_("Professor Inactivo")
            )


@frappe.whitelist()
def get_curriculum_subjects(school_class, academic_year=None):
    filters = {"school_class": school_class, "is_active": 1}
    curriculums = frappe.get_all("Class Curriculum", filters=filters, order_by="creation desc")
    
    if not curriculums:
        return []
        
    curriculum = frappe.get_doc("Class Curriculum", curriculums[0].name)
    default_teacher = frappe.db.get_value("School Class", school_class, "default_teacher")
    
    result = []
    for line in curriculum.subject_lines:
        is_spec = frappe.db.get_value("Subject", line.subject, "is_specialized_subject")
        
        teacher = None
        if not is_spec and default_teacher:
            teacher = default_teacher
            
        result.append({
            "subject": line.subject,
            "teacher": teacher
        })
        
    return result
