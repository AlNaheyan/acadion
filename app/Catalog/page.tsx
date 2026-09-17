"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Nav from "../../components/Nav"
import { ChevronDown, ChevronUp, Search, Filter, BookOpen } from "lucide-react"

interface Course {
  code: string
  name: string
  prerequisites: string[]
  category: string
  credits: number | null
  description: string | null
}

function CourseCard({ course }: { course: Course }) {
  const [open, setOpen] = useState(false)

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h2 className="text-xl font-bold text-black">{course.name}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm font-semibold bg-gray-100 px-2 py-1 rounded">{course.code}</span>
              <span className="text-sm text-gray-600">{course.category}</span>
              {course.credits && <span className="text-sm text-gray-500">{course.credits} credits</span>}
            </div>
          </div>
        </div>

        <Button
          size="sm"
          variant="ghost"
          className="mt-2 font-bold hover:bg-gray-100"
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? (
            <>
              <span>Show Less</span>
              <ChevronUp className="w-4 h-4 ml-1" />
            </>
          ) : (
            <>
              <span>Show Details</span>
              <ChevronDown className="w-4 h-4 ml-1" />
            </>
          )}
        </Button>

        {open && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
            <div>
              <span className="font-bold text-black">Prerequisites:</span>
              <p className="text-gray-700 mt-1">
                {course.prerequisites.length > 0 ? course.prerequisites.join(", ") : "None"}
              </p>
            </div>
            <div>
              <span className="font-bold text-black">Description:</span>
              <p className="text-gray-700 mt-1">{course.description || "No description available"}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function CoursesRevampedPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(true)

  useEffect(() => {
    fetch("/api/courses")
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text()
          throw new Error(`Server Error: ${res.status} ${text}`)
        }
        return res.json()
      })
      .then(setCourses)
      .catch((err) => console.error("Error fetching courses:", err))
  }, [])

  const categories = Array.from(new Set(courses.map((c) => c.category)))

  const handleCategoryChange = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    )
  }

  const clearFilters = () => {
    setSelectedCategories([])
    setSearchQuery("")
  }

  const filteredCourses = courses.filter(
    (course) =>
      course.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (selectedCategories.length === 0 || selectedCategories.includes(course.category)),
  )

  return (
    <div className="min-h-screen bg-white p-10 mx-auto mt-20">
      <Nav />

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <BookOpen className="w-8 h-8" />
          <h1 className="text-4xl font-bold">Course Catalog</h1>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Filters Sidebar */}
        <div className={`transition-all duration-300 ${showFilters ? "w-80" : "w-0 overflow-hidden"}`}>
          <div className="sticky top-24 bg-white rounded-lg border p-6 max-h-[calc(100vh-120px)] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center">
                <Filter className="w-5 h-5 mr-2" />
                Filters
              </h2>
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-gray-500 hover:text-black">
                Clear All
              </Button>
            </div>

            {/* Search */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Search Courses</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Course name or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Category Filters */}
            <div>
              <label className="block text-sm font-medium mb-3">Categories</label>
              <div className="space-y-3">
                {categories.map((category) => (
                  <div key={category} className="flex items-center space-x-3">
                    <Checkbox
                      id={category}
                      checked={selectedCategories.includes(category)}
                      onCheckedChange={() => handleCategoryChange(category)}
                    />
                    <label htmlFor={category} className="text-sm font-medium cursor-pointer">
                      {category}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Filters */}
            {(selectedCategories.length > 0 || searchQuery) && (
              <div className="mt-6 pt-4 border-t">
                <h3 className="text-sm font-medium mb-2">Active Filters:</h3>
                <div className="space-y-1">
                  {searchQuery && <div className="text-xs bg-gray-100 px-2 py-1 rounded">Search: {searchQuery}</div>}
                  {selectedCategories.map((cat) => (
                    <div key={cat} className="text-xs bg-gray-100 px-2 py-1 rounded">
                      Category: {cat}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {/* Results Header */}
          <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-lg border">
            <div>
              <h2 className="text-xl font-semibold">
                {filteredCourses.length} Course{filteredCourses.length !== 1 ? "s" : ""} Found
              </h2>
              <p className="text-gray-600 text-sm">
                {selectedCategories.length > 0 && `Filtered by: ${selectedCategories.join(", ")}`}
              </p>
            </div>
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              {showFilters ? "Hide" : "Show"} Filters
            </Button>
          </div>

          {/* Course Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredCourses.map((course) => (
              <CourseCard key={course.code} course={course} />
            ))}
          </div>

          {filteredCourses.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg border">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No courses found</h3>
              <p className="text-gray-600">Try adjusting your search or filter criteria</p>
              <Button onClick={clearFilters} className="mt-4 bg-black hover:bg-gray-800 text-white">
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
